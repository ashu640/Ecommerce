import mongoose, { Mongoose } from "mongoose";
const orderSchema=new mongoose.Schema({
    items:[{
        quantity:{
            type:Number,
            required:true,
        },
        product:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Product",
            required:true,
        },
    }],
    method:{
        type:String,
        required:true,
    },
    paymentInfo:{
        type:String,
    },
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        required:true,
    },
    phone:{
        type:Number,
        required:true,

    },
    address:{
        type:String,
        required:true,

    },
    paidAt:{
        type:String,
    },
    subTotal:{
        type:Number,
        required:true,

    },
    createdAt:{
        type:Date,
        default:Date.now(),
    },
    status:{
        type:String,
        default:"pending",
        
    }

},
{
    timestamps:true
});
export const Order=mongoose.model("Order",orderSchema)