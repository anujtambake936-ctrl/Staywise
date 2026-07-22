const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const PaymentSchema = new Schema({
  user:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listing:         { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
  amount:          { type: Number, required: true },
  currency:        { type: String, default: 'INR' },
  status:          { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
  stripeSessionId: String,
  checkIn:         Date,
  checkOut:        Date,
  nights:          Number,
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
