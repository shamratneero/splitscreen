import ExpoModulesCore
import Vision
import UIKit
import FoundationModels

/**
 * On-device receipt OCR through Apple's Vision framework.
 *
 * Chosen over Tesseract for the packaged app because Vision is trained on
 * photographed documents — creased paper, uneven lighting, a shadow down one
 * side — which is exactly the failure case that made Tesseract miss lines. It
 * is also free, runs offline, and never sends the photo anywhere.
 *
 * Bengali is not among Vision's 30 recognised languages, so a receipt printed
 * in Bengali script will not read. Most Dhaka restaurant receipts print item
 * names in Latin script, and the host reviews every scan before sharing.
 */
public class ReceiptVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReceiptVisionModule")

    AsyncFunction("structure") { (text: String) -> [String: Any]? in
      guard #available(iOS 26.0, *) else { return nil }
      guard SystemLanguageModel.default.availability == .available else { return nil }

      let receipt = try await StructuredReceipt.structure(text: text)
      return [
        "merchant": receipt.merchant,
        "items": receipt.items.map { ["name": $0.name, "quantity": $0.quantity, "unitPrice": $0.unitPrice] },
        "vat": receipt.vat,
        "serviceCharge": receipt.serviceCharge,
        "discount": receipt.discount,
        "total": receipt.total,
      ]
    }

    AsyncFunction("recognize") { (base64: String) -> [String: Any] in
      guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
            let image = UIImage(data: data),
            let cgImage = image.cgImage else {
        throw ImageDecodeException()
      }

      return try await Self.recognizeText(in: cgImage, hint: Self.cgOrientation(image.imageOrientation))
    }
  }


  /** UIImage carries EXIF orientation; Vision wants the CoreGraphics enum. */
  private static func cgOrientation(_ orientation: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch orientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }

  /**
   * Receipts get photographed sideways more often than not — the paper is tall
   * and narrow, so people turn the phone. Vision does not rotate anything for
   * you: text at 90 degrees is simply not recognised, which reads as the
   * scanner failing when it is really being handed an unreadable image.
   *
   * Try every quarter turn and keep whichever reads best. Recognition is fast
   * enough on-device that four passes still feel instant, and this removes the
   * single biggest cause of a failed scan.
   */
  private static func recognizeText(in cgImage: CGImage, hint: CGImagePropertyOrientation) async throws -> [String: Any] {
    // The photo's own metadata first: when it is right, the rest are skipped
    // by the early exit below.
    var candidates: [CGImagePropertyOrientation] = [hint]
    for orientation in [CGImagePropertyOrientation.up, .right, .down, .left] where orientation != hint {
      candidates.append(orientation)
    }

    var best: [String: Any] = ["text": "", "confidence": 0.0]
    var bestScore = 0.0

    for orientation in candidates {
      let result = try await recognizeOnce(in: cgImage, orientation: orientation)
      let text = result["text"] as? String ?? ""
      let confidence = result["confidence"] as? Double ?? 0

      // Score on how much was read and how sure Vision was. A wrong rotation
      // yields a few stray fragments at low confidence; the right one yields
      // the whole receipt.
      let lines = text.split(separator: "\n").count
      let score = Double(text.count) * (confidence / 100.0) + Double(lines)

      if score > bestScore {
        bestScore = score
        best = result
      }

      // Plainly correct already — don't spend three more passes proving it.
      if lines >= 12 && confidence >= 65 { break }
    }

    return best
  }

  private static func recognizeOnce(
    in cgImage: CGImage,
    orientation: CGImagePropertyOrientation
  ) async throws -> [String: Any] {
    try await withCheckedThrowingContinuation { continuation in
      let request = VNRecognizeTextRequest { request, error in
        if let error {
          continuation.resume(throwing: RecognitionException(error.localizedDescription))
          return
        }

        let observations = request.results as? [VNRecognizedTextObservation] ?? []

        // Vision returns observations in no guaranteed order. A receipt is read
        // top to bottom, and the parser downstream is line-oriented, so sort by
        // vertical position — origin is bottom-left, hence the descending sort.
        let ordered = observations.sorted { lhs, rhs in
          abs(lhs.boundingBox.midY - rhs.boundingBox.midY) < 0.006
            ? lhs.boundingBox.minX < rhs.boundingBox.minX
            : lhs.boundingBox.midY > rhs.boundingBox.midY
        }

        var lines: [String] = []
        var total: Float = 0
        var counted = 0

        for observation in ordered {
          guard let candidate = observation.topCandidates(1).first else { continue }
          lines.append(candidate.string)
          total += candidate.confidence
          counted += 1
        }

        continuation.resume(returning: [
          "text": lines.joined(separator: "\n"),
          "confidence": counted > 0 ? Double(total / Float(counted)) * 100 : 0,
        ])
      }

      // Accurate over fast: a misread price costs someone money, and a receipt
      // is one photo rather than a video stream.
      request.recognitionLevel = .accurate
      // Prices and quantities are not words; language correction "fixes" them
      // into nonsense.
      request.usesLanguageCorrection = false
      request.recognitionLanguages = ["en-US"]
      // Receipt type is small in frame; this stops tiny lines being discarded.
      request.minimumTextHeight = 0.008

      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      do {
        try handler.perform([request])
      } catch {
        continuation.resume(throwing: RecognitionException(error.localizedDescription))
      }
    }
  }
}

internal final class ImageDecodeException: Exception {
  override var reason: String { "That photo could not be read. Try a JPEG or PNG." }
}

internal final class RecognitionException: GenericException<String> {
  override var reason: String { "Could not read the receipt: \(param)" }
}
