import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import BackToDashboard from "../../components/BackToDashboard";
import CenterSelect from "../../components/CenterSelect";
import GradeSelect from '../../components/CourseSelect';
import CourseTypeSelect from '../../components/CourseTypeSelect';
import AccountStateSelect from '../../components/AccountStateSelect';
import Title from '../../components/Title';
import { useCreateStudent } from '../../lib/api/students';
import Image from 'next/image';


export default function AddStudent() {
  const containerRef = useRef(null);
  const [form, setForm] = useState({
    name: "",
    grade: "",
    courseType: "basics", // Default to basics
    school: "",
    homeschooling: false,
    phone: "",
    parentsPhone: "",
    parentsPhone2: "",
    address: "",
    main_center: "",
    comment: "",
    account_state: "Activated", // Default to Activated
  });
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState(""); // Separate state for success message text
  const [newId, setNewId] = useState("");
  const [showQRButton, setShowQRButton] = useState(false);
  const [error, setError] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // 'grade', 'center', or null
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide success message text after 5 seconds, but keep success state for buttons
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
        // Also blur any focused input to close browser autocomplete
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }
    };

    // Also handle when a dropdown opens to close others
    const handleDropdownOpen = () => {
      // Close any open dropdowns when a new one opens
      if (openDropdown) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('focusin', handleDropdownOpen);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('focusin', handleDropdownOpen);
    };
  }, [openDropdown]);

  const router = useRouter();
  
  // React Query hook for creating students
  const createStudentMutation = useCreateStudent();

  const handleChange = (e) => {
    // Reset QR button if user starts entering new data (when form was previously empty)
    if (showQRButton && !form.name && !form.grade && !form.school && !form.phone && !form.parentsPhone && !form.main_center) {
      setShowQRButton(false);
      setNewId("");
    }
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    
    // Validate phone numbers (no length restriction, but check for "+" at start)
    const studentPhone = form.phone;
    const parentPhone = form.parentsPhone;
    const parentPhone2 = form.parentsPhone2;
    
    // Check if phone numbers start with "+" (not allowed)
    if (studentPhone.startsWith('+')) {
      setError("Student phone number cannot start with '+'");
      return;
    }
    
    if (parentPhone.startsWith('+')) {
      setError("Parent's phone number cannot start with '+'");
      return;
    }
    
    if (parentPhone2.startsWith('+')) {
      setError("Parent's phone 2 number cannot start with '+'");
      return;
    }
    
    // Check if student phone number is the same as parent phone number 1
    if (studentPhone === parentPhone) {
      setError("Student phone number cannot be the same as parent phone number 1");
      return;
    }
    
    // Check if student phone number is the same as parent phone number 2
    if (studentPhone === parentPhone2) {
      setError("Student phone number cannot be the same as parent phone number 2");
      return;
    }
    
    // Check if parent phone numbers are the same
    if (parentPhone === parentPhone2) {
      setError("Parent's phone numbers cannot be the same");
      return;
    }
    
    // Map parentsPhone to parents_phone for backend - preserve leading zeros by storing as strings
    const payload = { ...form, parents_phone: parentPhone, parents_phone2: form.parentsPhone2 };
    payload.phone = studentPhone; // Keep as string to preserve leading zeros exactly
    
    // Handle school field based on homeschooling checkbox
    if (form.homeschooling) {
      payload.school = "Homeschooling";
    }
    let gradeClean = payload.grade.toLowerCase().replace(/\./g, '');
    payload.grade = gradeClean;
    // Optional main_comment: send as main_comment field
    const mc = form.comment && form.comment.trim() !== '' ? form.comment.trim() : null;
    payload.main_comment = mc;
    delete payload.comment;
    delete payload.parentsPhone;
    
    createStudentMutation.mutate(payload, {
      onSuccess: (data) => {
        setSuccess(true);
        setSuccessMessage(`✅ Student added successfully! ID: ${data.id}`); // Use server-generated ID
        setNewId(data.id); // Use server-generated ID
        setShowQRButton(true); // Show QR button after successful submission
        
        // Reset form fields after successful submission
        setForm({
          name: "",
          grade: "",
          courseType: "basics", // Reset to basics default
          school: "",
          homeschooling: false,
          phone: "",
          parentsPhone: "",
          parentsPhone2: "",
          address: "",
          main_center: "",
          comment: "",
          account_state: "Activated", // Reset to default
        });
      },
      onError: (err) => {
        setError(err.response?.data?.error || err.message);
      }
    });
  };

  const handleCreateQR = () => {
    if (newId) {
      router.push(`/dashboard/qr_generator?mode=single&id=${newId}`);
    }
  };

  const handleAttendStudent = () => {
    if (newId) {
      router.push(`/dashboard/scan_page?studentId=${newId}&autoSearch=true`);
    }
  };


  const goBack = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ padding: "20px 5px 20px 5px" }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
        <style jsx>{`
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
            text-align: center;
            margin-bottom: 32px;
          }
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .form-group {
            margin-bottom: 24px;
          }
          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #495057;
            font-size: 0.95rem;
          }
          .form-input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
          }
          .form-input:focus {
            outline: none;
            border-color: #87CEEB;
            background: white;
            box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
          }
          .form-input::placeholder {
            color: #adb5bd;
          }
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(135, 206, 235, 0.3);
            margin-top: 8px;
          }
          .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(135, 206, 235, 0.4);
          }
          .success-message {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          }
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          .id-feedback {
            margin-top: 8px;
            font-size: 0.9rem;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: 500;
          }
          .id-feedback.checking {
            background: #f8f9fa;
            color: #6c757d;
            border: 1px solid #dee2e6;
          }
          .id-feedback.taken {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .id-feedback.available {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .error-border {
            border-color: #dc3545 !important;
            box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
          }
        `}</style>
        <Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/user-plus2.svg" alt="Add Student" width={32} height={32} />
            Add Student
          </div>
        </Title>
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="name"
                placeholder="Enter student's full name"
                value={form.name}
                onChange={handleChange}
                required
                autocomplete="off"
              />
            </div>
            <div className="form-group">
              <label>Course <span style={{color: 'red'}}>*</span></label>
              <GradeSelect 
                selectedGrade={form.grade} 
                onGradeChange={(grade) => handleChange({ target: { name: 'grade', value: grade } })} 
                required 
                isOpen={openDropdown === 'grade'}
                onToggle={() => setOpenDropdown(openDropdown === 'grade' ? null : 'grade')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <div className="form-group">
              <label>Course Type <span style={{color: 'red'}}>*</span></label>
              <CourseTypeSelect 
                selectedCourseType={form.courseType} 
                onCourseTypeChange={(courseType) => handleChange({ target: { name: 'courseType', value: courseType } })} 
                required 
                isOpen={openDropdown === 'courseType'}
                onToggle={() => setOpenDropdown(openDropdown === 'courseType' ? null : 'courseType')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <label>School <span style={{color: 'red'}}>*</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', fontWeight: 'normal', color: '#666' }}>
                  <input
                    type="checkbox"
                    name="homeschooling"
                    checked={form.homeschooling}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      handleChange({ target: { name: 'homeschooling', value: isChecked } });
                    }}
                    style={{ margin: 0 }}
                  />
                  Homeschooling
                </label>
              </div>
              {!form.homeschooling && (
                <input
                  className="form-input"
                  name="school"
                  placeholder="Enter student's school"
                  value={form.school}
                  onChange={handleChange}
                  required
                  autocomplete="off"
                />
              )}
            </div>
            <div className="form-group">
              <label>Phone <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="phone"
                type="tel"
                inputMode="tel"
                placeholder="Enter student's phone number"
                value={form.phone}
                onChange={(e) => {
                  // Remove "+" if at start, only allow numbers
                  let value = e.target.value;
                  if (value.startsWith('+')) {
                    value = value.substring(1);
                  }
                  value = value.replace(/[^0-9]/g, '');
                  handleChange({ target: { name: 'phone', value } });
                }}
                required
                autocomplete="off"
              />
              <small style={{ color: '#6c757d', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                If the number is not Egyptian, include the country code, <strong>but do not add the "+".</strong>
              </small>
            </div>
            <div className="form-group">
              <label>Parent's Phone 1 (Whatsapp) <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="parentsPhone"
                type="tel"
                inputMode="tel"
                placeholder="Enter parent's phone number"
                value={form.parentsPhone}
                onChange={(e) => {
                  // Remove "+" if at start, only allow numbers
                  let value = e.target.value;
                  if (value.startsWith('+')) {
                    value = value.substring(1);
                  }
                  value = value.replace(/[^0-9]/g, '');
                  handleChange({ target: { name: 'parentsPhone', value } });
                }}
                required
                autocomplete="off"
              />
              <small style={{ color: '#6c757d', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                If the number is not Egyptian, include the country code, <strong>but do not add the "+".</strong>
              </small>
            </div>
            <div className="form-group">
              <label>Parent's Phone 2 <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="parentsPhone2"
                type="tel"
                inputMode="tel"
                placeholder="Enter second parent's phone number"
                value={form.parentsPhone2}
                onChange={(e) => {
                  // Remove "+" if at start, only allow numbers
                  let value = e.target.value;
                  if (value.startsWith('+')) {
                    value = value.substring(1);
                  }
                  value = value.replace(/[^0-9]/g, '');
                  handleChange({ target: { name: 'parentsPhone2', value } });
                }}
                required
                autocomplete="off"
              />
              <small style={{ color: '#6c757d', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                If the number is not Egyptian, include the country code, <strong>but do not add the "+".</strong>
              </small>
            </div>
            <div className="form-group">
              <label>Address <span style={{color: 'red'}}>*</span></label>
              <input
                className="form-input"
                name="address"
                placeholder="Enter student's address"
                value={form.address}
                onChange={handleChange}
                required
                autocomplete="off"
              />
            </div>
            <div className="form-group">
              <label>Main Center <span style={{color: 'red'}}>*</span></label>
              <CenterSelect 
                selectedCenter={form.main_center} 
                onCenterChange={(center) => handleChange({ target: { name: 'main_center', value: center } })} 
                required 
                isOpen={openDropdown === 'center'}
                onToggle={() => setOpenDropdown(openDropdown === 'center' ? null : 'center')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <AccountStateSelect
              value={form.account_state}
              onChange={(value) => handleChange({ target: { name: 'account_state', value } })}
              required={true}
            />
          <div className="form-group">
            <label>Hidden Comment (Optional)</label>
            <textarea
              className="form-input"
              name="comment"
              placeholder="Enter any notes about this student"
              value={form.comment}
              onChange={handleChange}
              rows={3}
              style={{ resize: 'vertical' }}
            />
          </div>
            <button 
              type="submit" 
              disabled={createStudentMutation.isPending} 
              className="submit-btn"
            >
              {createStudentMutation.isPending ? "Adding..." : "Add Student"}
            </button>
          </form>
        </div>
        
        {/* Success message and buttons outside form container */}
        {success && (
          <div>
            {successMessage && (
              <div className="success-message">{successMessage}</div>
            )}
            {showQRButton && (
              <div style={{ marginTop: 12 }}>
                <button className="submit-btn" onClick={handleCreateQR}>
                🏷️ Create QR Code for this ID: {newId}
                </button>
              </div>
            )}
            {showQRButton && (
              <div style={{ marginTop: 12 }}>
                <button 
                  className="submit-btn" 
                  onClick={handleAttendStudent}
                  style={{
                    background: 'linear-gradient(250deg, rgb(23, 162, 184) 0%, rgb(32, 201, 151) 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 10,
                    fontWeight: 600,
                    fontSize: '1rem',
                    padding: '14px 20px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(0, 123, 255, 0.3)',
                    width: '100%'
                  }}
                >
                  ✅ Attend This Student
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Error message outside form container */}
        {error && (
          <div className="error-message">❌ {error}</div>
        )}
      </div>
    </div>
  );
} 