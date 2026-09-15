const adminService = require('./admin.service');

const getDashboard = async (req, res, next) => {
  try {
    const result = await adminService.getDashboardStats();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const result = await adminService.getUsers(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getUser = async (req, res, next) => {
  try {
    const result = await adminService.getUserById(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const result = await adminService.updateUser(req.params.id, req.body, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const { suspend, reason } = req.body;
    const result = await adminService.suspendUser(req.params.id, suspend, reason, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAdvisors = async (req, res, next) => {
  try {
    const result = await adminService.getAdvisors(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateAdvisorStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await adminService.updateAdvisorStatus(req.params.id, status, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateAdvisor = async (req, res, next) => {
  try {
    const result = await adminService.updateAdvisor(req.params.id, req.body, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getPlans = async (req, res, next) => {
  try {
    const result = await adminService.getPlans();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createPlan = async (req, res, next) => {
  try {
    const result = await adminService.createPlan(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updatePlan = async (req, res, next) => {
  try {
    const result = await adminService.updatePlan(req.params.id, req.body, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deletePlan = async (req, res, next) => {
  try {
    const result = await adminService.deletePlan(req.params.id, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getQueue = async (req, res, next) => {
  try {
    const result = await adminService.getApprovalsQueue();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const approveMember = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const result = await adminService.approveMember(req.params.id, notes, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const rejectMember = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const result = await adminService.rejectMember(req.params.id, notes, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const result = await adminService.createUser(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await adminService.deleteUser(req.params.id, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createAdvisor = async (req, res, next) => {
  try {
    const result = await adminService.createAdvisor(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getInvoices = async (req, res, next) => {
  try {
    const result = await adminService.getInvoices();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getPayouts = async (req, res, next) => {
  try {
    const result = await adminService.getPayouts();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createInvoice = async (req, res, next) => {
  try {
    const result = await adminService.createInvoice(req.body, req.user.id);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getSakhiContent = async (req, res, next) => {
  try {
    const result = await adminService.getSakhiContent(req.query);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createSakhiContent = async (req, res, next) => {
  try {
    const result = await adminService.createSakhiContent(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateSakhiContent = async (req, res, next) => {
  try {
    const result = await adminService.updateSakhiContent(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteSakhiContent = async (req, res, next) => {
  try {
    const result = await adminService.deleteSakhiContent(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const releasePayout = async (req, res, next) => {
  try {
    const result = await adminService.releasePayout(req.params.id, req.user.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAffiliateReferrals = async (req, res, next) => {
  try {
    const result = await adminService.getAffiliateReferrals();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAdminCommunityCircles = async (req, res, next) => {
  try {
    const result = await adminService.getAdminCommunityCircles();
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createCommunityCircle = async (req, res, next) => {
  try {
    const result = await adminService.createCommunityCircle(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const updateCommunityCircle = async (req, res, next) => {
  try {
    const result = await adminService.updateCommunityCircle(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const deleteCommunityCircle = async (req, res, next) => {
  try {
    const result = await adminService.deleteCommunityCircle(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const getAdminCircleMessages = async (req, res, next) => {
  try {
    const result = await adminService.getAdminCircleMessages(req.params.id);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const toggleBlockCommunityMember = async (req, res, next) => {
  try {
    const { userId, isBlocked } = req.body;
    const result = await adminService.toggleBlockCommunityMember(req.params.id, userId, isBlocked);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getUsers,
  getUser,
  updateUser,
  suspendUser,
  deleteUser,
  getAdvisors,
  updateAdvisorStatus,
  updateAdvisor,
  getPlans,
  createPlan,
  updatePlan,
  deletePlan,
  getQueue,
  approveMember,
  rejectMember,
  createUser,
  createAdvisor,
  getInvoices,
  createInvoice,
  getSakhiContent,
  createSakhiContent,
  updateSakhiContent,
  deleteSakhiContent,
  getPayouts,
  releasePayout,
  getAffiliateReferrals,
  getAdminCommunityCircles,
  createCommunityCircle,
  updateCommunityCircle,
  deleteCommunityCircle,
  getAdminCircleMessages,
  toggleBlockCommunityMember
};
