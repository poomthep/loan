-- ========================================
-- SUPABASE DATABASE SCHEMA FOR LOAN APP
-- ========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- TABLES
-- ========================================

-- ธนาคารและสถาบันการเงิน
CREATE TABLE banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  short_name VARCHAR(20) NOT NULL UNIQUE,
  logo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- อัตราดอกเบี้ย MRR อ้างอิง
CREATE TABLE mrr_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('MORTGAGE', 'REFINANCE', 'PERSONAL', 'SME')),
  rate DECIMAL(5,2) NOT NULL,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bank_id, product_type, effective_date)
);

-- โปรโมชันและข้อเสนอพิเศษ
CREATE TABLE promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('MORTGAGE', 'REFINANCE', 'PERSONAL', 'SME')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  discount_bps INTEGER DEFAULT 0, -- basis points ส่วนลด
  remaining_months INTEGER DEFAULT 0, -- เดือนที่เหลือใน %
  year1_rate DECIMAL(5,2), -- อัตราปี 1
  year1_months INTEGER DEFAULT 12,
  year2_rate DECIMAL(5,2), -- อัตราปี 2  
  year2_months INTEGER DEFAULT 12,
  year3_rate DECIMAL(5,2), -- อัตราปี 3
  year3_months INTEGER DEFAULT 12,
  final_rate DECIMAL(5,2), -- อัตราหลังโปร = MRR - discount_bps
  ltv_override DECIMAL(5,2), -- LTV พิเศษ
  active BOOLEAN DEFAULT true,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- กฎเกณฑ์และเงื่อนไขของแต่ละธนาคาร
CREATE TABLE bank_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES banks(id) ON DELETE CASCADE,
  product_type VARCHAR(20) NOT NULL CHECK (product_type IN ('MORTGAGE', 'REFINANCE', 'PERSONAL', 'SME')),
  property_type VARCHAR(20) CHECK (property_type IN ('HOUSE', 'TOWNHOME', 'CONDO', 'LAND+HOUSE')), 
  home_number INTEGER CHECK (home_number IN (1, 2, 3)), -- บ้านหลังที่เท่าไร
  dsr_cap DECIMAL(5,2) CHECK (dsr_cap > 0 AND dsr_cap <= 100), -- DSR ขั้นสูง %
  ltv_cap DECIMAL(5,2) CHECK (ltv_cap > 0 AND ltv_cap <= 100), -- LTV ขั้นสูง %
  max_tenure_years INTEGER CHECK (max_tenure_years > 0 AND max_tenure_years <= 50), -- ผ่อนสูงสุด ปี
  max_age_at_maturity INTEGER CHECK (max_age_at_maturity > 0 AND max_age_at_maturity <= 100), -- อายุสูงสุดเมื่อผ่อนครบ
  min_income DECIMAL(12,2) CHECK (min_income >= 0), -- รายได้ขั้นต่ำ
  mlc_per_month DECIMAL(10,2) CHECK (mlc_per_month >= 0), -- ค่าครองชีพขั้นต่ำ/เดือน
  active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- ลำดับความสำคัญในการประมวลผล
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ประวัติการคำนวณของผู้ใช้
CREATE TABLE user_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id VARCHAR(100), -- สำหรับ guest users
  product_type VARCHAR(20) CHECK (product_type IN ('MORTGAGE', 'REFINANCE', 'PERSONAL', 'SME')),
  income DECIMAL(12,2) NOT NULL CHECK (income >= 0),
  debt DECIMAL(12,2) DEFAULT 0 CHECK (debt >= 0),
  income_extra DECIMAL(12,2) DEFAULT 0 CHECK (income_extra >= 0),
  age INTEGER CHECK (age >= 18 AND age <= 80),
  tenure_years INTEGER CHECK (tenure_years > 0),
  property_value DECIMAL(15,2) CHECK (property_value >= 0),
  property_type VARCHAR(20),
  home_number INTEGER,
  loan_amount DECIMAL(15,2) CHECK (loan_amount >= 0),
  calculation_mode VARCHAR(10) CHECK (calculation_mode IN ('max', 'check')),
  results JSONB, -- เก็บผลการคำนวณทั้งหมด
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles (ขยายข้อมูลจาก auth.users)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Promotions
CREATE INDEX idx_promotions_active_product ON promotions(active, product_type) WHERE active = true;
CREATE INDEX idx_promotions_bank_product ON promotions(bank_id, product_type, active);
CREATE INDEX idx_promotions_dates ON promotions(valid_from, valid_until) WHERE active = true;

-- Bank Rules
CREATE INDEX idx_bank_rules_bank_product ON bank_rules(bank_id, product_type, active) WHERE active = true;
CREATE INDEX idx_bank_rules_property ON bank_rules(property_type, home_number) WHERE active = true;

-- User Calculations
CREATE INDEX idx_user_calculations_user_created ON user_calculations(user_id, created_at DESC);
CREATE INDEX idx_user_calculations_session ON user_calculations(session_id, created_at DESC);

-- MRR Rates
CREATE INDEX idx_mrr_rates_bank_product ON mrr_rates(bank_id, product_type, effective_date DESC);

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on all tables
ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrr_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Public read access for public data
CREATE POLICY "Public read banks" ON banks FOR SELECT USING (active = true);
CREATE POLICY "Public read mrr_rates" ON mrr_rates FOR SELECT USING (active = true);
CREATE POLICY "Public read promotions" ON promotions 
  FOR SELECT USING (active = true AND (valid_until IS NULL OR valid_until >= CURRENT_DATE));
CREATE POLICY "Public read bank_rules" ON bank_rules FOR SELECT USING (active = true);

-- Admin policies
CREATE POLICY "Admin full access banks" ON banks 
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "Admin full access mrr_rates" ON mrr_rates 
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "Admin full access promotions" ON promotions 
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin');
CREATE POLICY "Admin full access bank_rules" ON bank_rules 
  FOR ALL USING (auth.jwt() ->> 'user_role' = 'admin');

-- User calculation policies
CREATE POLICY "Users own calculations" ON user_calculations 
  FOR ALL USING (
    auth.uid() = user_id OR 
    (auth.uid() IS NULL AND session_id IS NOT NULL)
  );

-- User profile policies  
CREATE POLICY "Users own profile" ON user_profiles 
  FOR ALL USING (auth.uid() = id);

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at (with safety checks)
DROP TRIGGER IF EXISTS update_banks_updated_at ON banks;
CREATE TRIGGER update_banks_updated_at BEFORE UPDATE ON banks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_mrr_rates_updated_at ON mrr_rates;
CREATE TRIGGER update_mrr_rates_updated_at BEFORE UPDATE ON mrr_rates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_promotions_updated_at ON promotions;
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON promotions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bank_rules_updated_at ON bank_rules;
CREATE TRIGGER update_bank_rules_updated_at BEFORE UPDATE ON bank_rules 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    CASE WHEN NEW.email LIKE '%@admin.%' THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user signup (with IF NOT EXISTS equivalent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ========================================
-- SAMPLE DATA
-- ========================================

-- Insert sample data (with conflict handling)
INSERT INTO banks (name, short_name, logo_url) VALUES
('ธนาคารกสิกรไทย', 'KBANK', null),
('ธนาคารกรุงเทพ', 'BBL', null),
('ธนาคารไทยพาณิชย์', 'SCB', null),
('ธนาคารกรุงไทย', 'KTB', null),
('ธนาคารทหารไทยธนชาต', 'TTB', null),
('ธนาคารกรุงศรีอยุธยา', 'BAY', null),
('ธนาคารยูโอบี', 'UOB', null),
('ธนาคารซิตี้แบงก์', 'CITI', null),
('ธนาคารสแตนดาร์ดชาร์เตอร์ด', 'SCBT', null),
('ธนาคารไอซีบีซี (ไทย)', 'ICBC', null)
ON CONFLICT (short_name) DO NOTHING;

-- Insert sample MRR rates (with conflict handling)
INSERT INTO mrr_rates (bank_id, product_type, rate) 
SELECT b.id, 'MORTGAGE', 7.25 FROM banks b WHERE b.short_name IN ('KBANK', 'BBL', 'SCB')
ON CONFLICT (bank_id, product_type, effective_date) DO NOTHING;

INSERT INTO mrr_rates (bank_id, product_type, rate) 
SELECT b.id, 'REFINANCE', 7.00 FROM banks b WHERE b.short_name IN ('KBANK', 'BBL', 'SCB')
ON CONFLICT (bank_id, product_type, effective_date) DO NOTHING;

-- Insert sample promotions
INSERT INTO promotions (bank_id, product_type, title, description, discount_bps, year1_rate, final_rate)
SELECT b.id, 'MORTGAGE', 'โปรโมชันสินเชื่อบ้านดอกพิเศษ', 'ดอกเบี้ยพิเศษสำหรับลูกค้าใหม่', 50, 3.99, 6.75
FROM banks b WHERE b.short_name = 'KBANK';

-- Insert sample bank rules
INSERT INTO bank_rules (bank_id, product_type, dsr_cap, ltv_cap, max_tenure_years, max_age_at_maturity, min_income)
SELECT b.id, 'MORTGAGE', 70.00, 90.00, 30, 70, 15000
FROM banks b WHERE b.short_name IN ('KBANK', 'BBL', 'SCB');

-- ========================================
-- VIEWS FOR EASIER QUERYING
-- ========================================

-- Views for easier querying (with safe creation)
DROP VIEW IF EXISTS active_promotions;
CREATE VIEW active_promotions AS
SELECT 
  p.*,
  b.name as bank_name,
  b.short_name as bank_short_name,
  m.rate as mrr_rate,
  (m.rate - (p.discount_bps::decimal / 100)) as calculated_final_rate
FROM promotions p
JOIN banks b ON p.bank_id = b.id
LEFT JOIN mrr_rates m ON p.bank_id = m.bank_id AND p.product_type = m.product_type
WHERE p.active = true 
  AND b.active = true
  AND (p.valid_until IS NULL OR p.valid_until >= CURRENT_DATE)
  AND (m.active = true OR m.active IS NULL);

-- View สำหรับดู bank rules พร้อมข้อมูลธนาคาร  
DROP VIEW IF EXISTS active_bank_rules;
CREATE VIEW active_bank_rules AS
SELECT 
  r.*,
  b.name as bank_name,
  b.short_name as bank_short_name
FROM bank_rules r
JOIN banks b ON r.bank_id = b.id
WHERE r.active = true AND b.active = true
ORDER BY r.priority, b.short_name;

-- ========================================
-- FINAL SETUP NOTES
-- ========================================

-- คำสั่งเพิ่มเติมหลัง setup:
-- 1. ไปที่ Supabase Dashboard > Authentication > Settings
-- 2. เปิด "Enable email confirmations" (ถ้าต้องการ)
-- 3. ตั้งค่า JWT expiry ตามต้องการ
-- 4. สร้าง Storage bucket สำหรับ logo images (ถ้าต้องการ)

COMMENT ON TABLE banks IS 'ธนาคารและสถาบันการเงิน';
COMMENT ON TABLE mrr_rates IS 'อัตราดอกเบี้ย MRR อ้างอิงของแต่ละธนาคาร';
COMMENT ON TABLE promotions IS 'โปรโมชันและข้อเสนอพิเศษ';
COMMENT ON TABLE bank_rules IS 'กฎเกณฑ์และเงื่อนไขของแต่ละธนาคาร';
COMMENT ON TABLE user_calculations IS 'ประวัติการคำนวณของผู้ใช้';
COMMENT ON TABLE user_profiles IS 'ข้อมูลโปรไฟล์ผู้ใช้เพิ่มเติม';