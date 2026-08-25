/**
 * The /transactions rows. See ./kds for why money is a string and ./tables
 * for what `D` is.
 *
 * receiptTime is a TIME column, which the driver returns anchored to the
 * epoch date — it carries a meaningful time of day and a meaningless date.
 */

export interface ReceiptListRow<D = string> {
  id: number;
  receiptDate: D;
  receiptTime: D;
  branchId: number;
  branchName: string;
  cashierName: string;
  customerName: string;
  itemCount: number;
  total: string;
  margin: string;
}

export interface ReceiptItemRow {
  id: number;
  productId: number;
  productName: string;
  brandName: string;
  quantity: string;
  totalPrice: string;
  totalCost: string;
  totalMargin: string;
}

export interface ReceiptDetail<D = string> extends ReceiptListRow<D> {
  items: ReceiptItemRow[];
}
