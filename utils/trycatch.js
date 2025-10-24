const TryCatch = (handler) => {
    return async (req, res, next) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        console.error("💥 Error:", error.message);
        return res.status(500).json({
          success: false,
          message: error.message || "Internal Server Error",
        });
      }
    };
  };
  export default TryCatch;
  