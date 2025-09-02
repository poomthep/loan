import { supabase } from "../config/supabase-init.js";
import { calculateLoan } from "./loan-calculator.js";

export async function calculateLoanWithPromo(amount, years) {
  const { data, error } = await supabase.from("promotions").select("*").limit(1).single();
  if (error) {
    console.error("ไม่สามารถโหลดโปรโมชัน:", error);
    return null;
  }
  const rate = data?.rate || 5.0;
  return calculateLoan(amount, rate, years);
}
