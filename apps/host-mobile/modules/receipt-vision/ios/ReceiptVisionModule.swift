import ExpoModulesCore
import Vision
import UIKit

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

    AsyncFunction("recognize") { (base64: String) -> [String: Any] in
      guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
            let image = UIImage(data: data),
            let cgImage = image.cgImage else {
        throw ImageDecodeException()
      }

      return try await Self.recognizeText(in: cgImage)
    }
  }

  private static func recognizeText(in cgImage: CGImage) async throws -> [String: Any] {
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

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
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
