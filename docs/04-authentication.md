# 04 - Authentication

## Overview

Authentication answers: "Who are you?" In our app, users prove their identity with a username and password, and we issue a token (JWT) stored in a secure cookie that proves they're logged in.

## Password Hashing with bcrypt

### Why Not Store Plain Text?

If the database is breached, attackers get every user's password. Since people reuse passwords, this compromises their other accounts too. We hash passwords so even a database breach doesn't reveal the actual passwords.

### How bcrypt Works

```
User enters: "myPassword123"
     ↓
bcrypt.hash("myPassword123", 12)
     ↓
Stored: "$2b$12$LJ3m4ys3Lk0TSwHCbsFbduNt0g/2GXcMODYAR2OI0.VPm.bJrFe2y"
```

1. **Hashing** — A one-way function. You can convert "password" → hash, but you cannot convert hash → "password"
2. **Salt** — bcrypt automatically generates a random salt (random data mixed with the password). Two users with the same password get different hashes. The salt is embedded in the hash string
3. **Cost factor (12)** — The number `12` means bcrypt does 2^12 = 4,096 iterations. This makes hashing deliberately slow (~250ms), which prevents brute-force attacks

### Verifying a Password

```typescript
const isValid = await bcrypt.compare(inputPassword, storedHash);
```

bcrypt extracts the salt from the stored hash, re-hashes the input password with the same salt, and compares. If they match, the password is correct.

## JWT (JSON Web Token)

### What is a JWT?

A JWT is a digitally signed token containing user information. It allows the server to verify a user's identity without querying the database on every request.

### Structure

A JWT has three parts separated by dots: `header.payload.signature`

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwidXNlcm5hbWUiOiJhZG1pbiJ9.ABC123signature
```

- **Header**: Algorithm used (HS256)
- **Payload**: User data (`{ id: 1, username: "admin", role: "admin" }`)
- **Signature**: Created using the payload + a secret key. If anyone tampers with the payload, the signature won't match

### Token Generation

```typescript
jwt.sign(
  { id: user.id, username: user.username, role: user.role },
  JWT_SECRET,
  { expiresIn: "7d" },
);
```

### Token Verification

```typescript
const decoded = jwt.verify(token, JWT_SECRET);
// decoded = { id: 1, username: "admin", role: "admin" }
```

If the token was modified or expired, `verify` throws an error.

## Why httpOnly Cookies (Not localStorage)

### The XSS Problem

If we stored the JWT in localStorage:

```javascript
localStorage.setItem("token", jwt); // DON'T DO THIS
```

Any JavaScript on the page can read it — including malicious scripts injected through XSS (Cross-Site Scripting) attacks. An attacker could steal the token.

### httpOnly Cookies

```typescript
res.cookie("token", jwt, {
  httpOnly: true, // JavaScript cannot read this cookie
  secure: true, // Only sent over HTTPS (production)
  sameSite: "strict", // Not sent on cross-site requests (CSRF prevention)
  maxAge: 7 * 24 * 60 * 60 * 1000, // Expires in 7 days
});
```

- **httpOnly**: The browser sends the cookie with every request automatically, but `document.cookie` in JavaScript cannot access it. This prevents XSS token theft
- **secure**: Only sent over HTTPS. Prevents interception on insecure connections
- **sameSite: 'strict'**: The browser won't send the cookie with requests from other websites. This prevents CSRF (Cross-Site Request Forgery) attacks

## Authentication Flow

### Registration

```
1. User submits: { username, email, password }
2. Server validates input (length, format)
3. Server checks: username/email not already taken
4. Server hashes password: bcrypt.hash(password, 12)
5. Server inserts user into database
6. Server creates JWT with user info
7. Server sets JWT as httpOnly cookie
8. Server returns user data (no password)
```

### Login

```
1. User submits: { username, password }
2. Server finds user by username
3. Server compares: bcrypt.compare(password, storedHash)
4. If match: create JWT, set cookie, return user data
5. If no match: return 401 "Invalid credentials"
```

Note: We return the same error for "user not found" and "wrong password." This prevents attackers from discovering valid usernames (user enumeration).

### Accessing Protected Routes

```
1. Browser automatically sends cookie with every request
2. Auth middleware extracts JWT from cookie
3. Middleware verifies JWT signature and expiration
4. If valid: attach user info to request, continue to route handler
5. If invalid: return 401 "Authentication required"
```

### Logout

```
1. Server clears the cookie: res.clearCookie('token')
2. The token is gone — user must log in again
```

## Auth Middleware

The `authenticate` middleware is a function that runs before protected route handlers:

```typescript
export function authenticate(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return next(new AppError("Authentication required", 401));

  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded; // Attach user info to the request
  next(); // Continue to the route handler
}
```

Routes use it like this:

```typescript
router.get("/cart", authenticate, cartHandler);
// authenticate runs first. If it calls next(), cartHandler runs.
// If it calls next(error), the error handler runs instead.
```

## Role-Based Access Control

Admin routes add a second middleware check:

```typescript
router.use(authenticate); // Must be logged in
router.use(requireAdmin); // Must have role === 'admin'
```

This is a simple but effective authorization pattern for two-role systems.
