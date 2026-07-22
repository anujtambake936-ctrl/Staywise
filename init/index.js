const dns = require("node:dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const mongoose=require("mongoose");
const initData=require("./data.js");
const Listing=require("../models/listing.js");

const MONGO_URL= process.env.DB_URL||"mongodb://127.0.0.1:27017/staywise";

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
   initData.data = initData.data.map((obj)=>({...obj,
      Owner:'6a60e7ea3369573be2a531f9',
      geometry: {
      type: "Point",
      coordinates: [72.8777, 19.0760] // Default dummy coordinates
    }
  }));
    
   await Listing.insertMany(initData.data);
    console.log("data was initialised");
 };

 // Add this temporarily to your index.js to see what's actually there


 initDB();