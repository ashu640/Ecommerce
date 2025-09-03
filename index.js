import express from 'express';
import dotenv from 'dotenv';
import connectDb from './utils/db.js';
import cloudinary from 'cloudinary';
import cors from 'cors';
import axios from 'axios'
import cookieParser from 'cookie-parser';
dotenv.config()
cloudinary.v2.config({
    cloud_name: process.env.CLOUD_NAME, 
        api_key: process.env.CLOUD_API_KEY, 
        api_secret: process.env.CLOUD_API_SECRET
});
const app=express();

const url = `https://ecommerce-15v7.onrender.com`;
const interval = 30000;
function reloadWebsite() {
    axios
      .get(url)
      .then((response) => {
        console.log("website reloded");
      })
      .catch((error) => {
        console.error(`Error : ${error.message}`);
      });
  }
  
  setInterval(reloadWebsite, interval);
app.use(express.json());
app.use(cors({
  origin: "https://ecommerce-frontend-sand-ten.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(cookieParser());

//importing routes
import userRoutes from'./routes/user.js';
import productRoutes from './routes/product.js';
import cartRoutes from './routes/cart.js';
import addressRoutes from './routes/address.js';
import orderRoutes from './routes/order.js';
import catalogueRoutes from './routes/catalogue.js';

//using routes
app.use('/api',userRoutes);
app.use('/api',productRoutes);
app.use('/api',cartRoutes);
app.use('/api',addressRoutes);
app.use('/api',orderRoutes);
app.use('/api',catalogueRoutes);





const port=process.env.PORT
app.listen(port,()=>{
    console.log(`server is running on http://localhost:${port}`);
    connectDb();
});

