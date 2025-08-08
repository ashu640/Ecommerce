import  express  from "express";
import { loginUser, logoutUser, myProfile, verifyUser } from "../controller/user.js";
import { isAuth } from "../middleware/isAuth.js";
const router=express.Router();
router.post("/user/login",loginUser);
router.post("/user/verify",verifyUser)
router.get("/user/me",isAuth,myProfile)
router.post("/user/logout",isAuth,logoutUser);
export default router;
