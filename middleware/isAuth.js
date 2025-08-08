import jwt from 'jsonwebtoken';
import { User } from '../model/User.js';
import dotenv from 'dotenv';

dotenv.config();

export const isAuth = async (req, res, next) => {
    try {

        const token = req.cookies.jwt;
       

        if (!token) {
           
            return res.status(403).json({
                message: "Please login",
            });
        }

        const decodedData = jwt.verify(token, process.env.JWT_SEC);
       

        const user = await User.findById(decodedData._id);
      

        if (!user) {
            return res.status(403).json({
                message: "User not found. Please login again.",
            });
        }

        req.user = user;
        
        next();

    } catch (error) {
      
        res.status(500).json({
            message: "Please login",
        });
    }
};
