const authService = require('./auth.service');

const login = async (req, res, next) => {
  try {
    const { email, role, password } = req.body;
    const result = await authService.sendOtp(email, role, password, req);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const result = await authService.verifyOtp(email, otp, req);
    
    if (result.success === false) {
      // Return 200 with success: false for PENDING_APPROVAL as defined in spec
      return res.status(200).json(result);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshSessionToken(refreshToken, req);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const currentUser = req.user; // populated by authenticate middleware if present
    const result = await authService.logoutSession(refreshToken, currentUser);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  verifyOtp,
  refreshToken,
  logout,
  register
};
