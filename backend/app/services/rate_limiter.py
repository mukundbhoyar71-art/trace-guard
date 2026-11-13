import time
from collections import defaultdict
from fastapi import HTTPException, status

class InMemoryRateLimiter:
    def __init__(self):
        # Maps key -> list of timestamps
        self.attempts = defaultdict(list)

    def check(self, key: str, max_attempts: int = 5, window_seconds: int = 60):
        now = time.time()
        window_start = now - window_seconds

        # Filter out old timestamps
        self.attempts[key] = [t for t in self.attempts[key] if t > window_start]

        if len(self.attempts[key]) >= max_attempts:
            retry_after = int(self.attempts[key][0] + window_seconds - now)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many requests. Please wait {max(1, retry_after)} seconds before retrying.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        self.attempts[key].append(now)

    def reset(self, key: str):
        if key in self.attempts:
            del self.attempts[key]

rate_limiter = InMemoryRateLimiter()

