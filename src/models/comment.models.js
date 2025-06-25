import mongoose, {Schema} from "mongoose";
import mongooseCastAggregation from 'mongoose-cast-aggregation';


const commentSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true
    }
)

commentSchema.plugin(mongooseCastAggregation);
export const Comment = mongoose.Model("Comment", commentSchema);    