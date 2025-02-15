import Lead from '../models/lead.js';
import User from '../models/user.js';
import FollowUp from '../models/followUp.js';
import Project from '../models/project.js';
import { createError, isValidDate } from '../utils/error.js';
import mongoose from 'mongoose';

export const getLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const findedLead = await Lead.findById(leadId)
            .populate('client')
            .populate("allocatedTo", "_id firstName lastName")
            .populate('property')
            .exec();

        if (!findedLead) return next(createError(400, 'Lead not exist'));

        res.status(200).json({ result: findedLead, message: 'Lead fetched successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getLeads = async (req, res, next) => {
    try {
        const findedLeads = await Lead.find().populate('client').populate('allocatedTo').populate('property').exec();
        res.status(200).json({ result: findedLeads, message: 'Leads fetched successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getLeadByPhone = async (req, res, next) => {
    try {
        const { phone } = req.params;
        const findedUser = await User.findOne({ phone });

        if (!findedUser) {
            return res.status(404).json({ message: 'User not found', success: false });
        }

        const findedLead = await Lead.find({ client: findedUser._id })
            .populate('allocatedTo', 'firstName lastName') // Populate allocatedTo with specific fields
            .populate('property', 'title address') // Populate property with specific fields
            .populate('client', 'name phone email') // Populate client with specific fields
            .populate( 'followUps', 'status followUpDate remarks' )
            .exec();

        if (findedLead.length === 0) {
            return res.status(404).json({ message: 'Lead not found', success: false });
        }

        const followUps = await FollowUp.find({ leadId: findedLead[0]._id });

        res.status(200).json({ result: findedLead, followUps, message: 'Lead fetched successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const getEmployeeLeads = async (req, res, next) => {
    try {
        const findedLeads = await Lead.find({ allocatedTo: req.user?._id, isArchived: false })
            .populate('property')
            .populate('client')
            .populate('allocatedTo')
            .exec();

        res.status(200).json({ result: findedLeads, message: 'Leads fetched successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

const priorities = [
    { name: "Very Hot", value: 'veryHot' },
    { name: "Hot", value: 'hot' },
    { name: "Moderate", value: 'moderate' },
    { name: "Cold", value: 'cold' },
    { name: "Very Cold", value: 'veryCold' },
];
const sources = [
    { name: "Instagram", value: 'instagram' },
    { name: "Facebook", value: 'facebook' },
    { name: "Facebook Comment", value: 'facebookComment' },
    { name: "Friend and Family", value: 'friendAndFamily' },
    { name: "Direct Call", value: 'directCall' },
    { name: "Google", value: 'google' },
    { name: "Referral", value: 'referral' },
];
const statuses = [
    { name: "New Client", value: "newClient" },
    { name: "Follow Up", value: "followUp" },
    { name: "Contacted Client", value: "contactedClient" },
    { name: "Call Not Attend", value: "callNotAttend" },
    { name: "Visit Schedule", value: "visitSchedule" },
    { name: "Visit Done", value: "visitDone" },
    { name: "Closed (Won)", value: "closedWon" },
    { name: "Closed (Lost)", value: "closedLost" },
  ];

export const getLeadsStat = async (req, res, next) => {
    const { type } = req.query;

    try {
        let pipeline = [];

        switch (type) {
            case 'status':
                pipeline = [
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 },
                        },
                    },
                ];
                break;

            case 'priority':
                pipeline = [
                    {
                        $group: {
                            _id: '$priority',
                            count: { $sum: 1 },
                        },
                    },
                ];
                break;

            case 'source':
                pipeline = [
                    {
                        $group: {
                            _id: '$source',
                            count: { $sum: 1 },
                        },
                    },
                ];
                break;

            case 'property':
                pipeline = [
                    {
                        $group: {
                            _id: '$property',
                            count: { $sum: 1 },
                        },
                    },
                ];
                break;

            default:
                return res.status(400).json({ error: 'Invalid type' });
        }

        const aggregatedResult = await Lead.aggregate(pipeline);

        if (type === 'property') {
            const allProjects = await Project.find({}, { title: 1, _id: 1 });
            const projectCounts = {};

            allProjects.forEach((project) => {
                projectCounts[project._id] = 0;
            });

            aggregatedResult.forEach((item) => {
                const projectId = item._id;
                const count = item.count || 0;
                projectCounts[projectId] = count;
            });

            const updatedResult = Object.entries(projectCounts).map(([projectId, count]) => {
                const project = allProjects.find((p) => p._id.toString() === projectId);
                const name = project ? project.title : '';
                return { _id: projectId, name, count };
            });

            res.status(200).json({ result: updatedResult, message: 'Stats fetched successfully.' });
        } else {
            const itemCounts = {};
            const allItems = type == 'priority' ? priorities : type == 'source' ? sources : statuses;

            allItems.forEach((item) => {
                itemCounts[item.value] = 0;
            });

            aggregatedResult.forEach((item) => {
                const itemName = item._id;
                const count = item.count || 0;
                itemCounts[itemName] = count;
            });

            const updatedResult = Object.keys(itemCounts).map((itemValue) => {
                const itemName = allItems.find((item) => item.value === itemValue)?.name || itemValue;
                return { _id: itemValue, name: itemName, count: itemCounts[itemValue] };
            });

            res.status(200).json({ result: updatedResult, message: 'Stats fetched successfully.' });
        }
    } catch (error) {
        next(createError(500, error));
    }
};

export const searchLead = async (req, res, next) => {
    try {
        const { query } = req.query;

        const foundLeads = await Lead.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'client',
                    foreignField: '_id',
                    as: 'clientData',
                },
            },
            {
                $match: {
                    $or: [
                        { 'clientData.firstName': { $regex: new RegExp(query, 'i') } },
                        { 'clientData.lastName': { $regex: new RegExp(query, 'i') } },
                        { 'clientData.username': { $regex: new RegExp(query, 'i') } },
                        { 'clientData.phone': { $regex: new RegExp(query, 'i') } },
                        { 'status': { $regex: new RegExp(query, 'i') } },
                        { 'priority': { $regex: new RegExp(query, 'i') } },
                        { 'city': { $regex: new RegExp(query, 'i') } },
                    ],
                },
            },
            {
                $project: {
                    client: { $arrayElemAt: ['$clientData', 0] },
                    city: 1,
                    priority: 1,
                    status: 1,
                    source: 1,
                    description: 1,
                    uid: 1,
                },
            },
        ]);

        res.status(200).json({
            result: foundLeads,
            message: 'Leads searched successfully',
            success: true,
        });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const filterLead = async (req, res, next) => {
    const { startingDate, endingDate, ...filters } = req.query;

    try {
        let query = Lead.find(filters);

        if (startingDate && isValidDate(startingDate)) {
            const startDate = new Date(startingDate);
            startDate.setHours(0, 0, 0, 0);
            query = query.where('createdAt').gte(startDate);
        }

        if (endingDate && isValidDate(endingDate)) {
            const endDate = new Date(endingDate);
            endDate.setHours(23, 59, 59, 999);

            if (query.model.modelName === 'Lead') {
                query = query.where('createdAt').lte(endDate);
            }
        }

        query = await query.populate('property').populate('client').populate('allocatedTo').exec();
        query = await query.populate('client').populate('allocatedTo').exec();

        res.status(200).json({ result: query });
    } catch (error) {
        next(createError(500, error.message));
    }
};

export const createLead = async (req, res, next) => {
    try {
        const { city, priority, area, property, status, source, description, count, clientName, clientPhone } = req.body;
        const { followUpStatus, followUpDate, remarks } = req.body  // for followup

        const alreadyExist = await Lead.findOne({ clientPhone: clientPhone });

        if (alreadyExist) {
            return res.status(400).json({ message: 'Lead already exist', success: false });
        }

        const foundLead = await User.findOne({ phone: clientPhone });

        const leadsToCreate = Number(count) || 1;
        const createdLeads = [];

        for (let i = 0; i < leadsToCreate; i++) {
            const newLead = await Lead.create({
                client: foundLead ? foundLead._id : null,
                city,
                clientName,
                clientPhone,
                priority,
                property,
                area,
                status,
                source,
                description,
                allocatedTo: [req.user?._id],
            });

            await FollowUp.create({ status: status, followUpDate, remarks: description, leadId: newLead._id })


            const populatedLead = await Lead.findById(newLead._id)
                .populate('client')
                .populate('property')
                .populate('allocatedTo')
                .exec();

            createdLeads.push(populatedLead);
        }

        res.status(200).json({
            result: createdLeads,
            message: `Lead(s) created successfully (${createdLeads.length} lead(s) created)`,
            success: true,
        });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const uploadLeads = async (req, res) => {
    try {
      const { leads } = req.body;
      if (!leads || !Array.isArray(leads) || leads.length === 0) {
        return res.status(400).json({ message: "No leads provided." });
      }

      const userId = req.user?._id;
  
      // Process each lead. You can add more mapping logic if needed.
      const newLeads = await Promise.all(
        leads.map(async (lead) => {
          // Optionally, resolve relations: for instance, find user by phone if needed
          const client = lead.clientPhone
            ? await User.findOne({ phone: lead.clientPhone })
            : null;
            const property = lead.project
            ? await Project.findOne({ uid: lead.project })
            : null;
  
          const newLead = new Lead({
            client: client ? client._id : null,
            property: property ? property._id : null,
            area: lead.area || "",
            city: lead.city || "",
            priority: lead.priority || "moderate",
            status: lead.status || "",
            clientName: lead.clientName || "",
            clientPhone: lead.clientPhone || "",
            source: lead.source || "",
            description: lead.description || "",
            allocatedTo: userId ? [userId] : [],
            images: [],
            isArchived: false,
            followUps: [],
            isAppliedForRefund: false,
            uid: lead.uid || "",
          });
          return await newLead.save();
        })
      );
  
      res.status(201).json({ message: "Leads uploaded successfully.", result: newLeads });
    } catch (error) {
      res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
  };
  
  export const updateLead = async (req, res, next) => {
    try {
      const { leadId } = req.params;
      let {
        firstName,
        lastName,
        area,
        username,
        phone,
        CNIC,
        clientCity,
        city,
        priority,
        property, // may be "Test1" (invalid ObjectId)
        status,
        source,
        description,
      } = req.body;
  
      // Get the existing lead
      const foundLead = await Lead.findById(leadId);
      if (!foundLead) {
        return next(createError(404, "Lead not found"));
      }
  
      // Resolve the property field:
      // Start with the existing property from foundLead
      let resolvedProperty = foundLead.property;
  
      if (property) {
        // If property is not a valid ObjectId, try to find a project by its name
        if (!mongoose.Types.ObjectId.isValid(property)) {
          const foundProject = await Project.findOne({ name: property });
          if (foundProject) {
            resolvedProperty = foundProject._id;
          }
          // If no project is found, we keep the existing property value.
        } else {
          // If property is a valid ObjectId, use it directly
          resolvedProperty = property;
        }
      }
  
      // Update the client information if applicable
      if (foundLead.client) {
        await User.findByIdAndUpdate(
          foundLead.client,
          {
            firstName,
            lastName,
            username,
            phone,
            CNIC,
            city: clientCity,
            project: resolvedProperty, // update client's project if needed
          },
          { new: true }
        );
      }
  
      // Prepare update data ensuring we use the resolvedProperty
      const updateData = {
        ...req.body,
        city,
        priority,
        property: resolvedProperty,
        area,
        status,
        source,
        description,
      };
  
      // Update the lead
      const updatedLead = await Lead.findByIdAndUpdate(leadId, updateData, {
        new: true,
      })
        .populate("property")
        .populate("client")
        .populate("allocatedTo")
        .exec();
  
      res
        .status(200)
        .json({ result: updatedLead, message: "Lead updated successfully", success: true });
    } catch (err) {
      next(createError(500, err.message));
    }
  };

export const shiftLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { shiftTo } = req.body;

        const updatedLead = await Lead.findByIdAndUpdate(
            leadId,
            { $set: { allocatedTo: [shiftTo] } },
            { new: true },
        )
            .populate('property')
            .populate('client')
            .populate('allocatedTo')
            .exec();

        res.status(200).json({
            result: updatedLead,
            message: 'Lead shifted successfully',
            success: true,
        });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const shareLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const { shareWith } = req.body;

        const updatedLead = await Lead.findByIdAndUpdate(
            leadId,
            { $push: { allocatedTo: shareWith } },
            { new: true },
        )
            .populate('property')
            .populate('client')
            .populate('allocatedTo')
            .exec();

        res.status(200).json({
            result: updatedLead,
            message: 'Lead shared successfully',
            success: true,
        });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const archiveLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const result = await Lead.findByIdAndUpdate(leadId, { $set: { isArchived: true } }, { new: true });
        res.status(200).json({ result, message: 'Lead archived successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const deleteLead = async (req, res, next) => {
    try {
        const { leadId } = req.params;
        const foundLead = await Lead.findById(leadId);

        if (!foundLead) return next(createError(400, 'Lead not exist'));

        // Delete all follow-ups associated with the lead
        await FollowUp.deleteMany({ leadId });

        // Delete the lead itself
        const deletedLead = await Lead.findByIdAndDelete(leadId);

        res.status(200).json({ result: deletedLead, message: 'Lead and associated follow-ups deleted successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};

export const deleteWholeCollection = async (req, res, next) => {
    try {
        const result = await Lead.deleteMany();
        res.status(200).json({ result, message: 'Lead collection deleted successfully', success: true });
    } catch (err) {
        next(createError(500, err.message));
    }
};
