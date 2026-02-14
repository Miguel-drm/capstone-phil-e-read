import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema({
	firebaseUid: { type: String, required: true, unique: true },
	name: { type: String, required: true },
	email: { type: String, required: true, unique: true },
	profileImage: { type: String }, // base64 string
}, { timestamps: true, collection: 'Parent' });

const Parent = mongoose.model('Parent', parentSchema);

export default Parent;



