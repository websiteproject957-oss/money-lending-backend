# Money Lending Backend API

Backend Node.js + Express + MongoDB สำหรับระบบจัดการเงินกู้

## Installation

```bash
npm install
```

## Setup Environment

สร้างไฟล์ `.env` จากตัวอย่าง:
```bash
cp .env.example .env
```

แล้วเพิ่ม MongoDB URI:
```
MONGODB_URI=mongodb+srv://websiteproject957_db_user:m6BkYZkCEXd9Rm5S@lending.gfwc0nw.mongodb.net/?appName=lending
PORT=5000
NODE_ENV=development
```

## Run Locally

```bash
# Development
npm run dev

# Production
npm start
```

## Deploy to Render

1. Push code ไป GitHub repo: `https://github.com/websiteproject957-oss/money-lending-backend`
2. เข้า Render.com > Dashboard > New Service > Connect GitHub
3. เลือก repo `money-lending-backend`
4. เลือก Environment: Node
5. Set Build Command: `npm install`
6. Set Start Command: `npm start`
7. เพิ่ม Environment Variable:
   - `MONGODB_URI`: [copy from MongoDB Atlas]
   - `NODE_ENV`: production
8. Deploy

## API Endpoints

### Customers
- `POST /getCustomers` - Get all customers
- `POST /addCustomer` - Add new customer
- `POST /updateCustomer` - Update customer
- `POST /deleteCustomer` - Delete customer

### Loans
- `POST /getLoans` - Get loans for a customer
- `POST /addLoan` - Add new loan

### Payments
- `POST /getPayments` - Get all payments
- `POST /addPayment` - Add new payment
- `POST /getMonthlySummary` - Get monthly summary

### Notifications
- `POST /getNotifications` - Get upcoming appointments

## Database Schema

### Customers
- customer_id (unique)
- name
- phone
- interest_rate
- appointment_date
- reminder_time
- status (ปกติ, ค้าง, หนี้เสีย)
- total_balance
- created_date

### Loans
- loan_id (unique)
- customer_id (indexed)
- principal
- start_date
- current_balance

### Payments
- payment_id (unique)
- loan_id (indexed)
- customer_id (indexed)
- payment_date
- pay_amount
- slip_url

### MonthlySummary
- month (YYYY-MM, unique)
- total_interest
- total_principal
- profit
