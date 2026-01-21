import React, { useState } from 'react';
import { useUpdateMessageState } from '../lib/api/students';
import Image from 'next/image';

const WhatsAppButton = ({ student, onMessageSent }) => {
  const [message, setMessage] = useState('');
  const updateMessageStateMutation = useUpdateMessageState();

  const handleWhatsAppClick = () => {
    setMessage('');

    try {
      // Validate and format phone number for WhatsApp
      let parentNumber = student.parents_phone ? student.parents_phone.replace(/[^0-9]/g, '') : null;
      
      // Enhanced validation for Egyptian phone numbers (must be exactly 11 digits)
      if (!parentNumber) {
        setMessage('Missing parent phone number');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Egyptian phone numbers must be exactly 11 digits
      if (parentNumber.length !== 11) {
        setMessage(`Invalid phone number: must be exactly 11 digits, got ${parentNumber.length}`);
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Must start with 01 (Egyptian mobile format)
      if (!parentNumber.startsWith('01')) {
        setMessage('Invalid phone number: must start with 01');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Check for suspicious patterns (like repeated digits)
      if (/^(.)\1{10}$/.test(parentNumber)) { // All same digit (e.g., 11111111111)
        setMessage('Invalid phone number format');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Format Egyptian phone numbers: 01XXXXXXXXX -> 2001XXXXXXXXX
      parentNumber = '20' + parentNumber.substring(1);

      // Validate student data
      if (!student.name) {
        setMessage('Student data incomplete - missing name');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }

      // Get current week data - assume we're working with the current week data
      const currentWeek = {
        attended: student.attended_the_session || false,
        lastAttendance: student.lastAttendance || 'N/A',
        hwDone: student.hwDone || false,
        quizDegree: student.quizDegree ?? null
      };


      // Create the message using the specified format
      // Extract first name from full name
      const firstName = student.name ? student.name.split(' ')[0] : 'Student';
      let whatsappMessage = `Follow up Message:

Dear, ${firstName}'s Parent
We want to inform you that we are in:

  • Week: ${student.currentWeekNumber || 1}
  • Attendance Info: ${currentWeek.attended ? `${currentWeek.lastAttendance}` : 'Absent'}`;

      // Only show attendance-related info if student attended
      if (currentWeek.attended) {
        // Format homework status properly
        let homeworkStatus = '';
        if (student.hwDone === true) {
          homeworkStatus = 'Done';
        } else if (student.hwDone === false) {
          homeworkStatus = 'Not Done';
        } else if (student.hwDone === 'No Homework') {
          homeworkStatus = 'No Homework';
        } else if (student.hwDone === 'Not Completed') {
          homeworkStatus = 'Not Completed';
        } else {
          homeworkStatus = 'Not Done'; // Default fallback
        }
        
        whatsappMessage += `
  • Homework: ${homeworkStatus}`;
  
        if (currentWeek.quizDegree !== null && String(currentWeek.quizDegree).trim() !== '') {
          whatsappMessage += `
  • Quiz Degree: ${currentWeek.quizDegree}`;
        }
      }
      
      // Add comment if it exists and is not null/undefined
      // Get comment from the current week data
      const currentWeekNumber = student.currentWeekNumber;
      const weekIndex = currentWeekNumber - 1;
      const weekData = student.weeks && student.weeks[weekIndex];
      const weekComment = weekData ? weekData.comment : null;
      
      if (weekComment && weekComment.trim() !== '' && weekComment !== 'undefined') {
        whatsappMessage += `
  • Comment: ${weekComment}`;
      }

      whatsappMessage += `
      
Note :-
  • ${firstName}'s ID: ${student.id}

We are always happy to stay in touch 😊❤

– Here's Mr. George's team`;

      // Create WhatsApp URL with the formatted message
      const whatsappUrl = `https://wa.me/${parentNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // Log the final phone number for debugging
      console.log('Attempting to send WhatsApp to:', parentNumber, 'Original:', student.parents_phone);
      
      // Try to open WhatsApp in a new tab/window
      const whatsappWindow = window.open(whatsappUrl, '_blank');
      
      // Check if window was blocked or failed to open
      if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed == 'undefined') {
        setMessage('Popup blocked - please allow popups and try again');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Additional check: if the window opened but immediately closed, it might be an invalid number
      setTimeout(() => {
        if (whatsappWindow.closed) {
          console.log('WhatsApp window closed immediately - possibly invalid number');
          // Note: We can't reliably detect this, so we'll rely on user feedback
        }
      }, 1000);
      
      // If we reach here, everything was successful
      setMessage('WhatsApp opened successfully!');
      
      // Update message state in database
      const weekNumber = student.currentWeekNumber || 1; // Use current week or default to 1
      console.log('Updating message state in database for student:', student.id, 'week:', weekNumber);
      console.log('Student data:', { id: student.id, currentWeekNumber: student.currentWeekNumber, name: student.name });
      console.log('Student weeks data:', student.weeks);
      
      updateMessageStateMutation.mutate(
        { id: student.id, message_state: true, week: weekNumber },
        {
          onSuccess: () => {
            console.log('Message state updated successfully in database');
            // Also call the parent callback for any additional local state management
            if (onMessageSent) {
              onMessageSent(student.id, true);
            }
          },
          onError: (error) => {
            console.error('Failed to update message state in database:', error);
            console.error('Error details:', error.response?.data || error.message);
            setMessage('WhatsApp sent but failed to update status');
            setTimeout(() => setMessage(''), 3000);
            // Don't call onMessageSent if database update fails
          }
        }
      );
      
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      // Handle any unexpected errors
      console.error('WhatsApp sending error:', error);
      setMessage('Error occurred while opening WhatsApp');
      setTimeout(() => setMessage(''), 3000);
      // Update database to mark as failed
      updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: student.currentWeekNumber || 1 });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleWhatsAppClick}
        style={{
          backgroundColor: '#25D366',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontWeight: '500',
          transition: 'background-color 0.2s'
        }}
      >
        <Image src="/whatsapp.svg" alt="WhatsApp" width={20} height={20} />
        Send
      </button>
      
      {message && (
        <div style={{
          fontSize: '10px',
          color: message.includes('success') ? '#28a745' : '#dc3545',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default WhatsAppButton; 