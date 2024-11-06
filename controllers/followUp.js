import mongoose from 'mongoose'
import FollowUp from '../models/followUp.js'
import { createError } from '../utils/error.js'
import Lead from '../models/lead.js'
import { parse, format, isValid } from 'date-fns'  // Ensure date-fns is installed and imported

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
        const currentDate = new Date();
        console.log("Current Date:", currentDate);

        // Fetch all follow-ups with nested populates and filter by non-archived leads
        const followUps = await FollowUp.find()
            .populate({
                path: 'leadId',
                match: { isArchived: false },
                populate: [
                    { path: 'client' },
                    { path: 'property' },
                    { path: 'allocatedTo' },
                ],
            }).exec();
        
        console.log("Fetched Follow-Ups:", followUps.length);

        // Helper function to parse and normalize followUpDate
        const normalizeDate = (dateStr) => {
            try {
                const parsedDate = parse(dateStr, 'd-M-yy', new Date());
                if (isValid(parsedDate)) {
                    return format(parsedDate, 'yyyy-MM-dd');
                }
                const fallbackDate = new Date(dateStr);
                return isValid(fallbackDate) ? format(fallbackDate, 'yyyy-MM-dd') : null;
            } catch (error) {
                console.error("Date parsing error:", error);
                return null;
            }
        };

        // Filter, map, and normalize follow-ups based on lead existence and valid date
        const validFollowUps = followUps.reduce((acc, followUp) => {
            if (followUp.leadId && followUp.followUpDate) {
                const normalizedDate = normalizeDate(followUp.followUpDate) || followUp.followUpDate;
                console.log(`Normalized Date for followUp ${followUp._id}:`, normalizedDate);

                if (new Date(normalizedDate) <= currentDate) {
                    followUp.followUpDate = normalizedDate;
                    acc.push(followUp);
                }
            }
            return acc;
        }, []);

        console.log("Valid Follow-Ups after filtering:", validFollowUps.length);

        // Get the latest follow-up for each lead based on createdAt timestamp
        const latestFollowUpsByLead = validFollowUps.reduce((result, followUp) => {
            const leadId = followUp.leadId._id.toString();
            if (!result[leadId] || new Date(followUp.createdAt) > new Date(result[leadId].createdAt)) {
                result[leadId] = followUp;
            }
            return result;
        }, {});

        console.log("Latest Follow-Ups by Lead:", Object.keys(latestFollowUpsByLead).length);

        // Convert the latest follow-ups to an array, sorted and grouped by followUpDate
        const groupedByDate = Object.values(latestFollowUpsByLead).reduce((acc, followUp) => {
            const followUpDate = followUp.followUpDate;
            if (!acc[followUpDate]) acc[followUpDate] = [];
            acc[followUpDate].push(followUp);
            return acc;
        }, {});

        console.log("Grouped Follow-Ups by Date:", Object.keys(groupedByDate));

        // Sort dates and create the final response structure
        const responseArray = Object.keys(groupedByDate)
            .sort((a, b) => new Date(a) - new Date(b))
            .map(date => ({
                date,
                followUps: groupedByDate[date],
            }));

        console.log("Final Response Array:", responseArray);

        res.status(200).json({ result: responseArray, message: "Stats fetched successfully.", success: true });
    } catch (error) {
        console.error("Error in getFollowUpsStats:", error);
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