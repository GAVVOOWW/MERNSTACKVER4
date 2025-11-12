import mongoose from "mongoose"; // used to import mongodb for connecting to the database


export const connectDB = async() => { // this is the function that will connect to the database

    try{
        const conn = await mongoose.connect(process.env.MONGO_URI);//this means that conn is the connection to the database

        console.log(`MongoDB Connected: ${conn.connection.host}`); // and if the connection is successful, the host will be printed

    } catch(error) {
        console.error(`Error: ${error.message}`);
        process.exit(1); // 1 is for failure and 0 is for success, 1 means exit with failure
    }


}


// DB.JS IS USED TO CONNECT TO THE DATABASE
