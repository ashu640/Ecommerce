import { Address } from "../model/address.js";
import TryCatch from "../utils/trycatch.js";

export const addAddress=TryCatch(async(req,res)=>{
    const {address,phone}=req.body;

    await Address.create({
        address,
        phone,
        user:req.user._id,
    });
    res.status(201).json({
        message:"Address created",

    })
});
export const getAllAddress=TryCatch(async(req,res)=>{
    const allAddress=await Address.find({user:req.user._id});
    res.json(allAddress);
})
export const getSingleAddress=TryCatch(async(req,res)=>{
    const address=await Address.findById(req.params.id);
    res.json(address);

});
export const deleteAddress=TryCatch(async(req,res)=>{
    const address=await Address.findOne({
        _id:req.params.id,
        user:req.user._id,
    });
    await address.deleteOne();
    res.json({message:
    "address deleted"});
    

})