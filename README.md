# Secure Information Hiding System Using Steganography

This repository contains the course project for **CSE 3206 – Software Engineering Lab**.
The system allows users to hide secret information inside digital media using steganography,
with optional password protection, and later extract it.

## Scope
The product focuses on secure data hiding while maintaining usability and data integrity for
academic purposes. It is intended to run on standard Windows or Linux desktops (or a modern
browser if implemented as a web app).

## Users
- **General User**: Embeds and extracts secret data with a simple interface.
- **Administrator**: Manages user access and monitors system usage.

## Core Features (Functional Requirements)
- User registration and login with username/password.
- Upload a cover media file for steganography.
- Input secret text or upload a secret file to hide.
- Optional password protection for hidden data.
- Embed secret data and download the resulting stego file.
- Upload a stego file for extraction.
- Extract and display hidden data when the correct password is provided.
- Prevent extraction when incorrect credentials are provided.
- Log embedding and extraction operations for monitoring.

## Quality Attributes (Non-Functional Requirements)
- **Performance**: Reasonable embedding/extraction time for standard-sized files.
- **Security**: Protect user credentials and secret data from unauthorized access.
- **Usability**: Simple, user-friendly interface without prior technical expertise.
- **Reliability**: Graceful handling of invalid inputs and errors.
- **Portability**: Operable across different operating systems without major changes.

## Constraints and Assumptions
- Secret data size is limited by the cover file capacity.
- Lossy media formats may reduce extraction accuracy.
- Open-source tools and libraries only.
- Users provide supported formats and do not tamper with stego files.

## Risks
- Unauthorized access if passwords are compromised.
- Data loss if stego files are modified.
- Extraction failure with unsupported file formats.

## Project References
- SRS: `srs.pdf`

## Status
Implementation details (tech stack, setup, and usage) will be added as development progresses.
