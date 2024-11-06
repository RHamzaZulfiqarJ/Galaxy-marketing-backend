import mongoose from 'mongoose'
import FollowUp from '../models/followUp.js'
import { createError } from '../utils/error.js'
import Lead from '../models/lead.js'
import { parse, format } from 'date-fns';

export const getFollowUp = async (req, res, next) => {
    try {

        const { followUpId } = req.params
        const findedFollowUp = await FollowUp.findById(followUpId).populate({
            path: 'leadId',
            populate: {
                path: 'client'
            }
        })
        if (!findedFollowUp) return next(createError(400, 'FollowUp not exist'))

        res.status(200).json({ result: findedFollowUp, message: 'followUp created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const getFollowUps = async (req, res, next) => {
    try {
        const { leadId } = req.params
        const findedFollowUp = await FollowUp.find({ leadId }).populate({
            path: 'leadId',
            populate: {
                path: 'client'
            }
        })

        res.status(200).json({ result: findedFollowUp, message: 'followUp created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const getEmployeeFollowUps = async (req, res, next) => {
    try {
        const { leadId } = req.params;

        // Find all follow-ups related to the given leadId
        const allFollowUps = await FollowUp.find({ leadId }).populate('leadId');

        const employeeFollowUps = allFollowUps.filter((followUp) => followUp.leadId?.allocatedTo?.findIndex(allocatedTo => allocatedTo.toString() == req.user?._id.toString()) != -1)

        res.status(200).json({ result: employeeFollowUps, message: 'FollowUps retrieved successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getEmployeeFollowUpsStats = async (req, res, next) => {
    try {
        // Fetch all follow-ups and populate the related leadId, client, property, and allocatedTo
        const allFollowUps = await FollowUp.find()
            .populate({
                path: 'leadId',
                match: { isArchived: false },  // Only include leads that are not archived
                populate: [
                    { path: 'client' },
                    { path: 'property' },
                    { path: 'allocatedTo' }
                ]
            })
            .exec();

        // Filter follow-ups by checking if the logged-in user is in the allocatedTo field
        const filteredFollowUps = allFollowUps.filter(followUp =>
            followUp.leadId?.allocatedTo.some(emp => emp._id.toString() === req.user?._id.toString())
        );

        // Get the current date
        const currentDate = new Date();

        // Normalize dates, filter out empty strings and future dates, and keep only the latest follow-up for each lead
        const latestFollowUpsByLead = filteredFollowUps.reduce((result, followUp) => {
            if (!followUp.followUpDate || followUp.followUpDate.trim() === '') {
                return result; // Exclude empty string dates
            }

            let normalizedDate;
            try {
                // Attempt to parse various date formats
                const parsedDate = parse(followUp.followUpDate, 'd-M-yy', new Date()) || new Date(followUp.followUpDate);
                normalizedDate = format(parsedDate, 'yyyy-MM-dd');
            } catch {
                normalizedDate = followUp.followUpDate; // Default to original if parsing fails
            }

            followUp.followUpDate = normalizedDate;

            // Exclude follow-ups with dates greater than the current date
            if (new Date(normalizedDate) > currentDate) {
                return result;
            }

            const leadId = followUp.leadId?._id.toString();
            if (!result[leadId] || new Date(followUp.followUpDate) > new Date(result[leadId].followUpDate)) {
                result[leadId] = followUp;
            }
            return result;
        }, {});

        // Convert the object to an array of follow-ups
        const latestFollowUpsArray = Object.values(latestFollowUpsByLead);

        // Sort follow-ups by followUpDate in ascending order
        latestFollowUpsArray.sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

        // Group the latest follow-ups by date for the final stats
        const groupedByDate = latestFollowUpsArray.reduce((result, followUp) => {
            const followUpDate = followUp.followUpDate; // Using normalized date directly

            if (!result[followUpDate]) {
                result[followUpDate] = [];
            }

            result[followUpDate].push(followUp);
            return result;
        }, {});

        // Convert grouped object to an array of objects with date and followUps array
        const responseArray = Object.keys(groupedByDate).map(date => ({
            date,
            followUps: groupedByDate[date]
        }));

        // Respond with the final grouped data
        res.status(200).json({ result: responseArray, message: "Stats fetched successfully.", success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getFollowUpsStats = async (req, res, next) => {
    try {
        const followUps = await FollowUp.find()
            .populate({
                path: 'leadId',
                match: { isArchived: false },  // Only include leads that are not archived
                populate: [
                    { path: 'client' },
                    { path: 'property' },
                    { path: 'allocatedTo' },
                ],
            }).exec();

        const currentDate = new Date();

        const validFollowUps = followUps
            .filter(followUp => followUp.leadId !== null)
            .map(followUp => {
                if (!followUp.followUpDate || followUp.followUpDate.trim() === '') {
                    return null;
                }

                let normalizedDate;
                try {
                    const parsedDate = parse(followUp.followUpDate, 'd-M-yy', new Date()) || new Date(followUp.followUpDate);
                    normalizedDate = format(parsedDate, 'yyyy-MM-dd');
                } catch {
                    normalizedDate = followUp.followUpDate;
                }

                followUp.followUpDate = normalizedDate;

                if (new Date(normalizedDate) > currentDate) {
                    return null;
                }

                return followUp;
            })
            .filter(followUp => followUp !== null);

        // Get the latest created follow-up for each lead
        const latestFollowUpsByLead = validFollowUps.reduce((result, followUp) => {
            const leadId = followUp.leadId._id.toString();

            // Use createdAt to find the most recently created follow-up
            if (!result[leadId] || new Date(followUp.createdAt) > new Date(result[leadId].createdAt)) {
                result[leadId] = followUp;
            }
            return result;
        }, {});

        const latestFollowUpsArray = Object.values(latestFollowUpsByLead)
            .filter(followUp => new Date(followUp.followUpDate) <= currentDate);

        latestFollowUpsArray.sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));

        const groupedByDate = latestFollowUpsArray.reduce((result, followUp) => {
            const followUpDate = followUp.followUpDate;

            if (!result[followUpDate]) {
                result[followUpDate] = [];
            }

            result[followUpDate].push(followUp);
            return result;
        }, {});

        const responseArray = Object.keys(groupedByDate).map(date => ({
            date,
            followUps: groupedByDate[date]
        }));

        res.status(200).json({ result: responseArray, message: "Stats fetched successfully.", success: true });
    } catch (error) {
        next(createError(500, error.message));
    }
};

export const createFollowUp = async (req, res, next) => {
    try {

        const { status, followUpDate, remarks, } = req.body
        if (!status || !followUpDate || !remarks)
            return next(createError(400, 'Make sure to provide all the fields'))

        const newFollowUp = await FollowUp.create(req.body)
        const UpdatedLeadStatus = await Lead.findByIdAndUpdate(newFollowUp.leadId, { status: status }, { new: true })

        res.status(200).json({ result: newFollowUp && UpdatedLeadStatus, message: 'followUp created successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteFollowUp = async (req, res, next) => {
    try {

        const { followUpId } = req.params
        const findedFollowUp = await FollowUp.findById(followUpId)
        if (!findedFollowUp) return next(createError(400, 'FollowUp not exist'))

        const deletedFollowUp = await FollowUp.findByIdAndDelete(followUpId)
        res.status(200).json({ result: deletedFollowUp, message: 'followUp deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}

export const deleteWholeCollection = async (req, res, next) => {
    try {

        const result = await FollowUp.deleteMany()
        res.status(200).json({ result, message: 'FollowUp collection deleted successfully', success: true })

    } catch (err) {
        next(createError(500, err.message))
    }
}