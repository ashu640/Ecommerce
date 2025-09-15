import { createTransport } from "nodemailer";

const sendOrderCancellation = async ({ email, subject, orderId, products, totalAmount,name}) => {
  const transport = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    auth: {
      user: process.env.Gmail,
      pass: process.env.Password,
    },
  });

  const productsHtml = products
    .map(
      (product) => `
            <tr>
                <td style="padding: 10px; border: 1px solid #ddd;">${product.name}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">${product.quantity}</td>
                <td style="padding: 10px; border: 1px solid #ddd;">₹${product.price}</td>
            </tr>
        `
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Cancelled</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f9f9f9;
            height: 100vh;
        }
        .container {
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        h1 {
            color: #e53935;
        }
        p {
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 10px;
            border: 1px solid #ddd;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
        .total {
            font-size: 18px;
            font-weight: bold;
            color: #000;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Order Cancelled</h1>
        <p>Dear ${name},</p>
        <p>We regret to inform you that your order (ID: <strong>${orderId}</strong>) has been cancelled.</p>
        <table>
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Price</th>
                </tr>
            </thead>
            <tbody>
                ${productsHtml}
            </tbody>
        </table>
        <p class="total">Total Amount: ₹${totalAmount}</p>
        <p>If you have already made a payment, a refund will be processed (if applicable).</p>
        <p>We apologize for the inconvenience and hope to serve you better next time.</p>
    </div>
</body>
</html>`;

  await transport.sendMail({
    from: process.env.Gmail,
    to: email,
    subject,
    html,
  });
};

export default sendOrderCancellation;
