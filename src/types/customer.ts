/** One row from the 顧客 sheet (顧客ID, 顧客姓名, 電話, IG, 加入日期). */
export type Customer = {
  /** 顧客ID */
  id: string;
  /** 顧客姓名 */
  name: string;
  /** 電話 — digits with country code (852…); empty if unknown */
  phone: string;
  /** IG — usually a profile link (https://www.instagram.com/…/); absent if blank */
  instagram?: string;
  /** 加入日期 as YYYY-MM-DD; absent if blank */
  joinedDate?: string;
};

/** Which 顧客 row to change: by 顧客ID, or by name for rows without one. */
export type CustomerKey = { id?: string; name: string };

/** Editable customer fields (Customer details → API). */
export type CustomerInput = {
  name: string;
  /** Digits as typed; 8-digit numbers are read back with the 852 prefix. */
  phone: string;
};
