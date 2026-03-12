"""
Seeds the database with student users from a CSV file.

This script is designed to be idempotent and robust. It inserts users one by one,
skipping any rows that cause an error and logging the issue, ensuring that one
bad row does not stop the entire process.

CSV Format (students.csv):
branch,enrollment_no,name

Example:
Computer Engineering,21BECE30001,John Doe

Execution:
python seed_users.py
"""

import csv
import logging
import os
from datetime import datetime
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app import create_app
from app.extensions import db
from app.models import User

app = create_app()
from sqlalchemy.exc import IntegrityError

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format="INFO:%(name)s:%(message)s"
)
logger = logging.getLogger("seed_users")

CSV_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "students.csv")


def seed_students():
    """Reads students from a CSV and inserts them into the database one by one for robustness."""
    with app.app_context():
        try:
            with open(CSV_FILE_PATH, mode='r', encoding='utf-8') as csvfile:
                reader = csv.reader(csvfile)
                next(reader)  # Skip the first empty/junk row
                next(reader)  # Skip the real header row

                # --- Efficient Duplicate Check ---
                # Fetch all existing enrollment numbers into a set for fast in-memory lookups.
                existing_enrollments = {
                    u.enrollment_no for u in User.query.with_entities(User.enrollment_no).all()
                }
                logger.info(f"Found {len(existing_enrollments)} existing students in the database.")

                users_added_count = 0
                skipped_count = 0

                for i, row in enumerate(reader, start=3): # Start at line 3 because header is 1 and 2
                    try:
                        # --- 1. Basic Validation ---
                        if len(row) < 3:
                            logger.warning(f"Skipping malformed row #{i}: Not enough columns.")
                            skipped_count += 1
                            continue

                        branch, enrollment_no, name = [field.strip() for field in row]

                        if not all([branch, enrollment_no, name]):
                            logger.warning(f"Skipping row #{i}: Contains empty required fields.")
                            skipped_count += 1
                            continue
                        
                        # User constraint check: skip if enrollment number already exists
                        if enrollment_no in existing_enrollments:
                            logger.info(f"Skipping row #{i}: Enrollment No '{enrollment_no}' already exists in DB.")
                            skipped_count += 1
                            continue

                        # --- 2. Create User Object ---
                        name_parts = name.strip().split()
                        
                        first_name = ""
                        last_name = ""

                        if len(name_parts) >= 2:
                            # Correctly assign LASTNAME and FIRSTNAME, ignore the rest.
                            last_name = name_parts[0].title()
                            first_name = name_parts[1].title()
                        elif len(name_parts) == 1:
                            # Fallback for single-word names.
                            first_name = name_parts[0].title()
                        
                        current_century = (datetime.now().year // 100) * 100
                        year_prefix = enrollment_no[:2]
                        admission_year = current_century + int(year_prefix)
                        batch = str(admission_year + 4) if year_prefix.isdigit() else "N/A"

                        user = User(
                            first_name=first_name, last_name=last_name,
                            email=f"{enrollment_no}@mail.ljku.edu.in",
                            university="L.J. University", major=branch, batch=batch,
                            account_type="student", is_verified=False,
                            enrollment_no=enrollment_no
                        )

                        # --- 3. Add and Commit (One by One) ---
                        db.session.add(user)
                        db.session.commit()
                        
                        users_added_count += 1
                        existing_enrollments.add(enrollment_no) # Add to set to prevent duplicates within the CSV

                    except IntegrityError as e:
                        db.session.rollback()
                        logger.warning(f"Skipping row #{i} due to DB constraint violation (likely a duplicate '{enrollment_no}').")
                        skipped_count += 1
                    except Exception as e:
                        db.session.rollback()
                        logger.error(f"Error processing row #{i}. Skipping. Error: {e}")
                        skipped_count += 1
                
                logger.info("--- Seeding Complete ---")
                logger.info(f"Total new users inserted: {users_added_count}")
                logger.info(f"Rows skipped (duplicates or errors): {skipped_count}")

        except FileNotFoundError:
            logger.error(f"Error: The file '{CSV_FILE_PATH}' was not found.")
        except Exception as e:
            logger.error(f"An unexpected error occurred during file processing: {e}")
            db.session.rollback()

if __name__ == "__main__":
    seed_students()