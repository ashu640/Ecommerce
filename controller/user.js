import { User } from "../model/User.js";
import { OTP } from "../model/otp.js";
import sendOtp from "../utils/sendotp.js";
import TryCatch from "../utils/trycatch.js";
import jwt from 'jsonwebtoken'

export const loginUser=TryCatch(async(req,res)=>{
    const {email}=req.body;
    const subject="Ecommerce App"
    const otp=Math.floor(Math.random()*1000000);
    const prevOtp=await OTP.findOne({
        email,

    });
    if(prevOtp){
        await prevOtp.deleteOne();

    }
    await sendOtp({email,subject,otp});
    await OTP.create({email,otp});
    res.json({
        message:"OTP send to your mail"
    })
});
export const verifyUser=TryCatch(async(req,res)=>{
    const {email,otp}=req.body;
    const haveOtp=await OTP.findOne({
        email,
        otp
    });
    if(!haveOtp) return res.status(400).json({
        message:"Wrong otp",

    });
    let user=await User.findOne({email})

    if(user){
        const token=jwt.sign({_id:user._id},process.env.JWT_SEC,{
            expiresIn:"15d",
        })
        await haveOtp.deleteOne();
        res.json({
            message:"User LoggedIn",
            token,
            user,

        });
    }else{
        const user=await User.create({
            email,

        });
        const token=jwt.sign({_id:User._id},process.env.JWT_SEC,{
            expiresIn:"15d",
        })
        await haveOtp.deleteOne();
        res.json({
            message:"user LoggedIn",
            token,
            user,  

        });
        
    }
});
export const myProfile=TryCatch(async(req,res)=>{
    const user=await User.findById(req.user._id)
    res.json(user);
})