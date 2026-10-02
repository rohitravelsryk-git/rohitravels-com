-- Migration: Seed unique discount vouchers
INSERT INTO public.vouchers (sr, agent_name, passenger_name, voucher_amount, pnr, expiry_date, airline, name, status, notes)
VALUES
  (1, 'Rohi Travels', 'Muhammad Muslim Shahzad', '528.00', '60SEHG', '2027-02-09', 'SalamAir / FlyJinnah', 'Muhammad Muslim Shahzad', 'Active', 'Restored from master records'),
  (2, 'Abdul Razzaq', 'Muhammad Iftikhar', '239.00', '6TLNE2', '2027-02-21', 'SalamAir / FlyJinnah', 'Muhammad Iftikhar', 'Active', 'Restored from master records'),
  (3, 'Abu Dhabi Travels', 'Abdul Latif', '0.00', '00', '2027-01-01', 'SalamAir / FlyJinnah', 'Abdul Latif', 'Active', 'Restored from master records'),
  (4, 'Madina Travels', 'Muhammad Akbar', '0.00', '00', '2027-01-01', 'SalamAir / FlyJinnah', 'Muhammad Akbar', 'Active', 'Restored from master records'),
  (5, 'Madina Travels', 'Muhammad Ismail', '0.00', '00', '2027-01-01', 'SalamAir / FlyJinnah', 'Muhammad Ismail', 'Active', 'Restored from master records'),
  (6, 'Danial Iqbal Travels', 'Amiran Khatoon', '54704.00', '4TQZFW', '2027-04-22', 'SalamAir / FlyJinnah', 'Amiran Khatoon', 'Active', 'Restored from master records'),
  (7, 'Danial Iqbal Travels', 'Moheen Khatoon', '54708.00', '4OJFXR', '2027-04-22', 'SalamAir / FlyJinnah', 'Moheen Khatoon', 'Active', 'Restored from master records'),
  (8, 'Mahar Bashir Travels', 'Muhammad Arshad', '42813.00', '67ZUEB', '2027-01-01', 'SalamAir / FlyJinnah', 'Muhammad Arshad', 'Active', 'Restored from master records'),
  (9, 'Madina Travels', 'Hasnain Ahmad', '0.00', '', '2027-06-06', 'SalamAir / FlyJinnah', 'Hasnain Ahmad', 'Active', 'Restored from master records'),
  (10, 'Madina Travels', 'Muhammad Shaban', '382.09', '6KJ83T', '2027-06-07', 'SalamAir / FlyJinnah', 'Muhammad Shaban', 'Active', 'Restored from master records'),
  (11, 'Danial Iqbal Travels', 'Muhammad Saleem', '26102.00', '157GBW', '2027-05-31', 'SalamAir / FlyJinnah', 'Muhammad Saleem', 'Active', 'Restored from master records'),
  (12, 'Danial Iqbal Travels', 'Shabbiran Mai', '26102.00', '157GBW', '2027-05-31', 'SalamAir / FlyJinnah', 'Shabbiran Mai', 'Active', 'Restored from master records'),
  (13, 'Danial Iqbal Travels', 'Mah Rang', '13090.00', '157GBW', '2027-05-31', 'SalamAir / FlyJinnah', 'Mah Rang', 'Active', 'Restored from master records'),
  (14, 'Blue Express Travels', 'Muhammad Waqar', '0.00', '', '2027-06-01', 'SalamAir / FlyJinnah', 'Muhammad Waqar', 'Active', 'Restored from master records'),
  (15, 'Blue Express Travels', 'Muhammad Asif', '0.00', '', '2027-06-01', 'SalamAir / FlyJinnah', 'Muhammad Asif', 'Active', 'Restored from master records'),
  (16, 'Blue Express Travels', 'Ali Raza', '0.00', '', '2027-06-01', 'SalamAir / FlyJinnah', 'Ali Raza', 'Active', 'Restored from master records'),
  (17, 'Rais Air Travels', 'Muhammad Shaban', '0.00', '', '2027-06-10', 'SalamAir / FlyJinnah', 'Muhammad Shaban', 'Active', 'Restored from master records'),
  (18, 'Rais Air Travels', 'Rasheed Ahmad', '0.00', '', '2027-06-10', 'SalamAir / FlyJinnah', 'Rasheed Ahmad', 'Active', 'Restored from master records'),
  (19, 'Mahar Bashir Travels', 'Abdul Malik', '0.00', '', '2027-06-17', 'SalamAir / FlyJinnah', 'Abdul Malik', 'Active', 'Restored from master records'),
  (20, 'Madina Travels', 'Munir Ahmad', '656.99', '6PWKQ9', '2027-07-13', 'SalamAir / FlyJinnah', 'Munir Ahmad', 'Active', 'Restored from master records'),
  (21, 'Madina Travels', 'Ghulam Muhammad', '656.99', '6E7PQR', '2027-07-13', 'SalamAir / FlyJinnah', 'Ghulam Muhammad', 'Active', 'Restored from master records'),
  (22, 'Laskani Air Travels', 'Abdul Hameed', '0.00', 'FIOZ64', '2027-07-14', 'SalamAir (OV)', 'Abdul Hameed', 'Active', 'Restored from master records'),
  (23, 'Rais Air Travels', 'Muhammad Nadeem', '0.00', '', '', 'SalamAir / FlyJinnah', 'Muhammad Nadeem', 'Active', 'Restored from master records'),
  (24, 'Sirani Travels And Tours', 'FAIZ UL HASSAN', '0.00', '', '', 'SalamAir (OV)', 'FAIZ UL HASSAN', 'Active', 'Restored from master records'),
  (25, 'Jahangir Sons Travel & Tours', 'FAYYAZ AHMAD', '0.00', '', '', 'SalamAir / FlyJinnah', 'FAYYAZ AHMAD', 'Active', 'Restored from master records')
ON CONFLICT DO NOTHING;