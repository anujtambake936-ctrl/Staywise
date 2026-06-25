const express=require("express");
const router=express.Router();

//index for users
router.get("/",(req,res)=>{
  res.send("GET for users");
})

//show users
router.get("/:id",(req,res)=>{
  res.send("GET for users");
})

//POST users
router.get("/",(req,res)=>{
  res.send("POST for users");
})

//delete
router.delete("/:id",(req,res)=>{
  res.send("DELETE for users");
})


module.exports=router;