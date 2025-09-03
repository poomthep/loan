export function calculateLoan(amount, rate, years) {
  const monthlyRate = rate / 100 / 12;
  const months = years * 12;
  const installment = (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return installment.toFixed(2);
}
