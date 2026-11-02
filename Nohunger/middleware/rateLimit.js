const buckets = new Map();

function rateLimit({ windowMs, max, keyGenerator = req => req.ip } = {}) {
  return (req, res, next) => {
    const key = String(keyGenerator(req));
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - bucket.count));
    res.setHeader("RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later."
      });
    }
    next();
  };
}

function clearRateLimits() {
  buckets.clear();
}

module.exports = { rateLimit, clearRateLimits };
