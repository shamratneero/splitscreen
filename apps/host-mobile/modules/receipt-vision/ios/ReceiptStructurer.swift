import Foundation
import FoundationModels

/**
 * Turns recognised receipt text into line items using Apple's on-device model.
 *
 * A rules parser cannot generalise across receipt layouts. A restaurant bill
 * puts the item name beside its price; the supermarket receipts in Dhaka put a
 * product code and the numbers on one line and the name on the next; a pharmacy
 * uses different columns again. Every new format is another special case, and
 * the failure is silent — a code like "A056661080" becomes the item name.
 *
 * The model reads the layout instead of us encoding it. It runs on the device,
 * costs nothing, needs no key, and the receipt never leaves the phone.
 */
@available(iOS 26.0, *)
struct StructuredReceipt {

  @Generable
  struct Receipt {
    @Guide(description: "The shop or restaurant name, from the top of the receipt.")
    var merchant: String

    @Guide(description: "Every purchased line item. Skip totals, taxes, discounts, points and payment lines.")
    var items: [Item]

    @Guide(description: "Tax or VAT charged on the whole bill, in whole currency units. 0 if absent.")
    var vat: Int

    @Guide(description: "Service charge on the whole bill, in whole currency units. 0 if absent.")
    var serviceCharge: Int

    @Guide(description: "Discount applied to the whole bill, in whole currency units. 0 if absent.")
    var discount: Int

    @Guide(description: "The final amount payable printed on the receipt, in whole currency units.")
    var total: Int
  }

  @Generable
  struct Item {
    @Guide(description: "What was bought, in words. Never a product code or barcode number.")
    var name: String

    @Guide(description: "How many were bought. At least 1.")
    var quantity: Int

    @Guide(description: "Price of ONE unit in whole currency units, not the line total.")
    var unitPrice: Int
  }

  static func structure(text: String) async throws -> Receipt {
    let session = LanguageModelSession(instructions: """
      You read receipts from Bangladesh and extract what was bought.

      The text comes from OCR of a photographed receipt, so it may be imperfect \
      and the columns may not line up. Layouts vary: some receipts put the item \
      name beside its price, others put a product code and the numbers on one \
      line with the item name on the line after it. Read the layout you are \
      given.

      Rules:
      - An item's name is words describing a product. A code like A056661080 is \
        never a name; if the name is on a neighbouring line, use that.
      - unitPrice is the price of ONE unit. If the receipt shows a line total \
        for several units, divide by the quantity.
      - Amounts are whole taka. Round to the nearest whole number.
      - Skip subtotals, taxes, discounts, loyalty points, change, payment \
        method lines and anything in the header or footer.
      - Do not invent items you cannot read.
      """)

    let response = try await session.respond(
      to: "Extract the items from this receipt:\n\n\(text)",
      generating: Receipt.self
    )
    return response.content
  }
}
