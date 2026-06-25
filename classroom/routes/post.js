const express=require("express");
const router=express.Router();

//index for posts
router.get("/",(req,res)=>{
  res.send("GET for posts");
})

//show posts
router.get("/:id",(req,res)=>{
  res.send("GET for posts");
})

//POST posts
router.get("/",(req,res)=>{
  res.send("POST for posts");
})

//delete
router.delete("/:id",(req,res)=>{
  res.send("DELETE for posts");
})

module.exports=router;