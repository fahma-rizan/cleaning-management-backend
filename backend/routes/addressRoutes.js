const express           = require('express');
const addressController = require('../controllers/addressController');
const { protect }       = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/',                      addressController.getAddresses);
router.post('/',                     addressController.addAddress);
router.put('/:addressId',            addressController.updateAddress);
router.delete('/:addressId',         addressController.deleteAddress);
router.patch('/:addressId/default',  addressController.setDefault);

module.exports = router;
