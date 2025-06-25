import mongoose , {Schema} from 'mongoose' ;
import mongooseCastAggregation from 'mongoose-cast-aggregation';

const videoSchema = new Schema(
    {
        videoFile: {
            type: String,
            required: true,
        },
        thumbnail: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: true
        },
        views: {
            type: Number,
            required: true,
            default: 0
        },
        duration: {
            type: Number,
            required: true
        },
        isPublished: {
            type: Boolean,
            required: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
)

videoSchema.plugin(mongooseCastAggregation)

export const Video = mongoose.model("Video" , videoSchema);