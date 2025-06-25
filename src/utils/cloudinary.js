import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configuration cloudinary 
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        // console.log("cloudinary.config:" , { 
        //         cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        //         api_key: process.env.CLOUDINARY_API_KEY, 
        //         api_secret: process.env.CLOUDINARY_API_SECRET
        //     });

        if(!localFilePath) return null;

        const result = await cloudinary.uploader.upload(
            localFilePath,{
                resource_type: "auto"
            }
        );

        console.log(`file uploaded on cloudinary. File src: ${result.url}`)
        
        // once file is uploaded we'll  delete it from our server
        fs.unlinkSync(localFilePath);
        return result

    } catch (error) {
        console.log("Error on cloudinary" , error);
        
        fs.unlinkSync(localFilePath);
        return null
    }
}

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log(`file deleted from cloudinary. File src: ${publicId}`)
    } catch (error) {
        console.log("Error deleting file from cloudinary" , error);
        return null
    }

}
export { uploadOnCloudinary , deleteFromCloudinary}