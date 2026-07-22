const mongoose=require("mongoose");
const Schema=mongoose.Schema;
const passportLocalMongoose=require("passport-local-mongoose").default;


const userSchema= new Schema({
    email:{
        type:String,
        required:true,
    },
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: String,
    role: {
        type: String,
        enum: ['user', 'host'],
        default: 'user'
    },
    hostInfo: {
        companyName: String,
        bio: String,
        gstNumber: String
    }
});
userSchema.plugin(passportLocalMongoose);
module.exports=mongoose.model("User",userSchema);
