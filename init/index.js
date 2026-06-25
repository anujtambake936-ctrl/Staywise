const mongoose=require("mongoose");
const initData=require("./data.js");
const Listing=require("../models/listing.js");

const MONGO_URL= process.env.DB_URL||"mongodb://127.0.0.1:27017/wanderlust";

main()
 .then(()=>{
    console.log("conected to DB");
 })
 .catch((err)=>{
    console.log(err);
 });

 async function main() {
    await mongoose.connect(MONGO_URL);
    
}



const initDB= async () => {
    await Listing.deleteMany({});
   initData.data = initData.data.map((obj)=>({...obj,Owner:'69da967d243a95f74ccc6e54'}));
    console.log(initData.data[0]);
   await Listing.insertMany(initData.data);
    console.log("data was initialised");
 };

 // Add this temporarily to your index.js to see what's actually there


 initDB();