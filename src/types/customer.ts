/** One row from the 顧客 sheet (顧客ID, 顧客姓名, 電話). */
export type Customer = {
  /** 顧客ID */
  id: string;
  /** 顧客姓名 */
  name: string;
  /** 電話 — digits with country code (852…); empty if unknown */
  phone: string;
};
