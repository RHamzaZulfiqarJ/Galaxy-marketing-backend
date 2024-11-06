import Sale from '../models/sale.js'
import { createError } from '../utils/error.js'


export const getSale = async (req, res, next) => {
    try {

        const { saleId } = req.params
        const findedSale = await Sale.findById(saleId).populate('project').exec()
        if (!findedSale) return next(createError(400, 'Sale not exist'))

        res.status(200).json({ result: findedSale, message: 'sale created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const getSales = async (req, res, next) => {
    try {

        const findedSale = await Sale.find().populate('project').exec()
        res.status(200).json({ result: findedSale, message: 'sales fetched successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}
export const getLeadSales = async (req, res, next) => {
    try {

        const { leadId } = req.query
        const findedLeads = await Sale.find({ leadId: leadId }).populate('leadId').populate('project').exec()
        res.status(200).json({ result: findedLeads, message: 'Sales fetched successfully', success: true });

    } catch (err) {
        next(createError(500, err.message));
    }
};
export const createSale = async (req, res, next) => {
    try {

        const { leadId, staff, clientName, project, propertyType, totalAmount, receivedAmount, buyingPrice, profit } = req.body

        let newSale;
        if (leadId) {
            newSale = await Sale.create({ staff, clientName, project, propertyType, totalAmount, receivedAmount, buyingPrice, profit, leadId })
        }
        else {
            newSale = await Sale.create({ staff, clientName, project, propertyType, totalAmount, receivedAmount, buyingPrice, profit })
        }

        res.status(200).json({ result: newSale, message: 'sale created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const updateSale = async (req, res, next) => {
    try {

        const { saleId } = req.params
        const findedSale = await Sale.findById(saleId)
        if (!findedSale) return next(createError(400, 'Sale not exist'))

        const updatedSale = await Sale.findByIdAndUpdate(saleId, { $set: req.body }, { new: true })
        res.status(200).json({ result: updatedSale, message: 'sale updated successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteSale = async (req, res, next) => {
    try {

        const { saleId } = req.params
        const findedSale = await Sale.findById(saleId)
        if (!findedSale) return next(createError(400, 'Sale not exist'))

        const deletedSale = await Sale.findByIdAndDelete(saleId)
        res.status(200).json({ result: deletedSale, message: 'sale deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteWholeCollection = async (req, res, next) => {
    try {

        const result = await Sale.deleteMany()
        res.status(200).json({ result, message: 'Sale collection deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}