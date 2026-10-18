import { useState, useEffect } from 'preact/hooks';
import { interviewApi, type InterviewSlot, type PendingInterview } from '@api/interview.api';
import InterviewFeedback from '../Components/InterviewFeedback';
import InterviewResultModal from '../Components/InterviewResultModal';
import { toastConfirm } from '../Components/Toast/Toast';
import './InterviewSchedulePage.css';

const InterviewSchedulePage = () => {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'morning' | 'afternoon' | 'evening'>('afternoon');
  const [slots, setSlots] = useState<Map<string, InterviewSlot>>(new Map());
  const [pendingInterviews, setPendingInterviews] = useState<PendingInterview[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalAction, setModalAction] = useState<'open' | 'delete' | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackInterviewId, setFeedbackInterviewId] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultTutorId, setResultTutorId] = useState<string | null>(null);
  const [resultTutorName, setResultTutorName] = useState<string | null>(null);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Generate week dates
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + (offset * 7));
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates(currentWeekOffset);

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateISO = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate time slots for different periods
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let h = 5; h < 24; h++) {
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      slots.push(`${hour12}:00 ${ampm}`);
      if (h < 23) {
        slots.push(`${hour12}:30 ${ampm}`);
      } else {
        slots.push('11:30 PM');
      }
    }
    return slots;
  };

  const allSlots = generateTimeSlots();
  const timeSlots = {
    morning: allSlots.filter(s => {
      const [t, p] = s.split(' ');
      const [h] = t.split(':').map(Number);
      const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
      return hour >= 5 && hour < 12;
    }),
    afternoon: allSlots.filter(s => {
      const [t, p] = s.split(' ');
      const [h] = t.split(':').map(Number);
      const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
      return hour >= 12 && hour < 18;
    }),
    evening: allSlots.filter(s => {
      const [t, p] = s.split(' ');
      const [h, m] = t.split(':').map(Number);
      const hour = p === 'PM' ? (h === 12 ? 12 : h + 12) : h;
      return hour >= 18 && (hour < 24 || (hour === 23 && m === 30));
    })
  };

  // Check if slot is in the past
  const isPastSlot = (date: Date, timeStr: string): boolean => {
    const now = new Date();
    const [time, period] = timeStr.split(' ');
    let [hour, minute] = time.split(':').map(Number);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    
    const slotDateTime = new Date(date);
    slotDateTime.setHours(hour, minute, 0, 0);
    return slotDateTime < now;
  };

  // Load schedule data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [scheduleData, pendingData] = await Promise.all([
          interviewApi.getWeekSchedule(currentWeekOffset),
          interviewApi.getPendingInterviews()
        ]);
        
        const newSlots = new Map<string, InterviewSlot>();
        scheduleData.slots.forEach(slot => {
          const slotDate = new Date(slot.date + 'T00:00:00');
          const dayIdx = weekDates.findIndex(d => 
            d.getFullYear() === slotDate.getFullYear() &&
            d.getMonth() === slotDate.getMonth() &&
            d.getDate() === slotDate.getDate()
          );
          if (dayIdx !== -1) {
            const key = `${dayIdx}-${slot.time}`;
            newSlots.set(key, slot);
          }
        });
        
        setSlots(newSlots);
        setPendingInterviews(pendingData);
      } catch (err: any) {
        console.error('Failed to load interview data:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [currentWeekOffset]);

  // Handle slot click
  const handleSlotClick = (dayIdx: number, time: string) => {
    const key = `${dayIdx}-${time}`;
    const date = weekDates[dayIdx];
    
    // Check if slot is completed - show result modal
    const existingSlot = slots.get(key);
    if (existingSlot && existingSlot.status === 'completed' && existingSlot.tutorId) {
      setResultTutorId(existingSlot.tutorId);
      setResultTutorName(existingSlot.tutorName || null);
      setShowResultModal(true);
      return;
    }
    
    // Don't allow selecting past slots
    if (isPastSlot(date, time)) return;
    
    // Check if slot is already booked
    if (existingSlot && existingSlot.status === 'booked') return;
    
    const newSelected = new Set(selectedSlots);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedSlots(newSelected);
  };

  // Open selected slots
  const handleOpenSlots = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    
    try {
      const slotsToOpen = Array.from(selectedSlots)
        .filter(key => !slots.has(key)) // Only create new slots
        .map(key => {
          const [dayIdx, time] = key.split('-');
          const date = weekDates[parseInt(dayIdx)];
          return { date: formatDateISO(date), time };
        });
      
      if (slotsToOpen.length > 0) {
        await interviewApi.createSlots(slotsToOpen);
      }
      
      // Reload data
      const scheduleData = await interviewApi.getWeekSchedule(currentWeekOffset);
      const newSlots = new Map<string, InterviewSlot>();
      scheduleData.slots.forEach(slot => {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const dayIdx = weekDates.findIndex(d => 
          d.getFullYear() === slotDate.getFullYear() &&
          d.getMonth() === slotDate.getMonth() &&
          d.getDate() === slotDate.getDate()
        );
        if (dayIdx !== -1) {
          const key = `${dayIdx}-${slot.time}`;
          newSlots.set(key, slot);
        }
      });
      setSlots(newSlots);
      setSelectedSlots(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to open slots');
    } finally {
      setLoading(false);
    }
  };

  // Delete selected slots
  const handleDeleteSlots = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    
    try {
      const slotIds = Array.from(selectedSlots)
        .filter(key => {
          const slot = slots.get(key);
          return slot && slot.status === 'open';
        })
        .map(key => slots.get(key)!.id);
      
      if (slotIds.length > 0) {
        await interviewApi.deleteSlots(slotIds);
      }
      
      // Reload data
      const scheduleData = await interviewApi.getWeekSchedule(currentWeekOffset);
      const newSlots = new Map<string, InterviewSlot>();
      scheduleData.slots.forEach(slot => {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const dayIdx = weekDates.findIndex(d => 
          d.getFullYear() === slotDate.getFullYear() &&
          d.getMonth() === slotDate.getMonth() &&
          d.getDate() === slotDate.getDate()
        );
        if (dayIdx !== -1) {
          const key = `${dayIdx}-${slot.time}`;
          newSlots.set(key, slot);
        }
      });
      setSlots(newSlots);
      setSelectedSlots(new Set());
    } catch (err: any) {
      setError(err.message || 'Failed to delete slots');
    } finally {
      setLoading(false);
    }
  };

  // Cancel interview
  const handleCancelInterview = async (slotId: string) => {
    if (!await toastConfirm('Are you sure you want to cancel this interview?', 'Cancel Interview')) return;
    
    try {
      await interviewApi.adminCancelBooking(slotId);
      
      // Reload data
      const [scheduleData, pendingData] = await Promise.all([
        interviewApi.getWeekSchedule(currentWeekOffset),
        interviewApi.getPendingInterviews()
      ]);
      
      const newSlots = new Map<string, InterviewSlot>();
      scheduleData.slots.forEach(slot => {
        const slotDate = new Date(slot.date + 'T00:00:00');
        const dayIdx = weekDates.findIndex(d => 
          d.getFullYear() === slotDate.getFullYear() &&
          d.getMonth() === slotDate.getMonth() &&
          d.getDate() === slotDate.getDate()
        );
        if (dayIdx !== -1) {
          const key = `${dayIdx}-${slot.time}`;
          newSlots.set(key, slot);
        }
      });
      setSlots(newSlots);
      setPendingInterviews(pendingData);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel interview');
    }
  };

  // Complete interview
  const handleCompleteInterview = async (slotId: string) => {
    try {
      await interviewApi.completeInterview(slotId);
      
      // Reload pending interviews
      const pendingData = await interviewApi.getPendingInterviews();
      setPendingInterviews(pendingData);
    } catch (err: any) {
      setError(err.message || 'Failed to complete interview');
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Calculate new vs existing slots
  const newSlotsCount = Array.from(selectedSlots).filter(key => !slots.has(key)).length;
  const existingSlotsCount = Array.from(selectedSlots).filter(key => {
    const slot = slots.get(key);
    return slot && slot.status === 'open';
  }).length;

  return (
    <div className="interview-page">
      {/* Page Header */}
      <div className="interview-header">
        <div className="interview-header-left">
          <div className="interview-header-icon">
            <i className="ri-calendar-schedule-line"></i>
          </div>
          <h1>Interview Scheduling</h1>
        </div>
        <div className="interview-actions">
          <button className="btn btn-secondary" onClick={() => setCurrentWeekOffset(0)}>
            <i className="ri-calendar-check-line" aria-hidden="true"></i> Today
          </button>
        </div>
      </div>

      {/* Schedule Card */}
      <div className="schedule-card">
        {/* Calendar Navigation */}
        <div className="calendar-nav">
          <div className="week-navigation">
            <button className="nav-btn" onClick={() => setCurrentWeekOffset(prev => prev - 1)}>
              <i className="ri-arrow-left-s-line" aria-hidden="true"></i>
              <span>Previous</span>
            </button>
            <span className="week-range">
              {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
            </span>
            <button className="nav-btn" onClick={() => setCurrentWeekOffset(prev => prev + 1)}>
              <span>Next</span>
              <i className="ri-arrow-right-s-line" aria-hidden="true"></i>
            </button>
          </div>
        {/* Period Tabs */}
        <div className="period-tabs" role="group" aria-label="Time of day">
          <button 
            className={`period-tab ${selectedPeriod === 'morning' ? 'active' : ''}`}
            aria-pressed={selectedPeriod === 'morning'}
            onClick={() => setSelectedPeriod('morning')}
          >
            <i className="ri-sun-line" aria-hidden="true"></i>
            Morning (5AM-12PM)
          </button>
          <button 
            className={`period-tab ${selectedPeriod === 'afternoon' ? 'active' : ''}`}
            aria-pressed={selectedPeriod === 'afternoon'}
            onClick={() => setSelectedPeriod('afternoon')}
          >
            <i className="ri-sun-cloudy-line" aria-hidden="true"></i>
            Afternoon (12PM-6PM)
          </button>
          <button 
            className={`period-tab ${selectedPeriod === 'evening' ? 'active' : ''}`}
            aria-pressed={selectedPeriod === 'evening'}
            onClick={() => setSelectedPeriod('evening')}
          >
            <i className="ri-moon-line" aria-hidden="true"></i>
            Evening (6PM-12AM)
          </button>
        </div>
        </div>

        {/* Calendar Grid */}
      {loading && !slots.size ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading schedule...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <i className="ri-error-warning-line"></i>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => setCurrentWeekOffset(currentWeekOffset)}>
            Retry
          </button>
        </div>
      ) : (
        <div className="calendar-container" role="region" aria-label="Interview calendar" tabIndex={0}>
          <div className="calendar-grid">
            {/* Header Row */}
            <div className="calendar-header">
              <div className="time-header"></div>
              {weekDates.map((date, idx) => (
                <div key={idx} className={`day-header ${isToday(date) ? 'today' : ''}`}>
                  <div className="day-name">{days[idx].substring(0, 3)}</div>
                  <div className="day-date">{date.getDate()}</div>
                </div>
              ))}
            </div>

            {/* Time Rows */}
            {timeSlots[selectedPeriod].map(time => (
              <div key={time} className="time-row">
                <div className="time-label">{time}</div>
                {weekDates.map((date, dayIdx) => {
                  const key = `${dayIdx}-${time}`;
                  const slot = slots.get(key);
                  const isPast = isPastSlot(date, time);
                  const isSelected = selectedSlots.has(key);
                  
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`slot-cell ${isPast ? 'past' : ''} ${isSelected ? 'selected' : ''}`}
                      disabled={slot?.status === 'booked' || (isPast && !(slot?.status === 'completed' && slot.tutorId))}
                      aria-pressed={isSelected}
                      aria-label={`${days[dayIdx]}, ${formatDate(date)}, ${time}${slot ? `, ${slot.status}${slot.tutorName ? `, ${slot.tutorName}` : ''}` : ', available'}`}
                      onClick={() => handleSlotClick(dayIdx, time)}
                    >
                      {slot && (
                        <span className={`slot-badge ${slot.status}`} title={slot.tutorName || slot.status}>
                          {slot.status === 'open' && <><i className="ri-door-open-line"></i> Open</>}
                          {slot.status === 'booked' && (
                            <><i className="ri-user-line"></i><span className="slot-name">{slot.tutorName?.split(' ')[0] || 'Booked'}</span></>
                          )}
                          {slot.status === 'completed' && <><i className="ri-check-line"></i> Done</>}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* Selection Bar */}
      {selectedSlots.size > 0 && (
        <div className="selection-bar">
          <span className="selection-count">
            {selectedSlots.size} slot{selectedSlots.size !== 1 ? 's' : ''} selected
          </span>
          {newSlotsCount > 0 && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                setModalAction('open');
                setShowConfirmModal(true);
              }}
            >
              <i className="ri-door-open-line" aria-hidden="true"></i> Open {newSlotsCount} New Slot{newSlotsCount !== 1 ? 's' : ''}
            </button>
          )}
          {existingSlotsCount > 0 && (
            <button 
              className="btn btn-danger"
              onClick={() => {
                setModalAction('delete');
                setShowConfirmModal(true);
              }}
            >
              <i className="ri-delete-bin-line"></i> Delete {existingSlotsCount} Slot{existingSlotsCount !== 1 ? 's' : ''}
            </button>
          )}
          <button 
            className="btn btn-secondary"
            onClick={() => setSelectedSlots(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Pending Interviews */}
      {pendingInterviews.length > 0 && (
        <div className="pending-interviews">
          <h2>Upcoming Interviews ({pendingInterviews.length})</h2>
          <div className="interview-list">
            {pendingInterviews.map(interview => (
              <div key={interview.id} className="interview-item">
                <div className="interview-info">
                  <span className="interview-tutor">{interview.tutorName}</span>
                  <div className="interview-meta">
                    <span><i className="ri-mail-line"></i> {interview.tutorEmail}</span>
                    <span><i className="ri-calendar-line"></i> {interview.date}</span>
                    <span><i className="ri-time-line"></i> {interview.time}</span>
                  </div>
                </div>
                <div className="interview-actions">
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => window.location.href = `/interview-room/${interview.id}`}
                  >
                    <i className="ri-video-chat-line"></i> Join
                  </button>
                  <button 
                    className="btn btn-success btn-sm"
                    onClick={() => {
                      setFeedbackInterviewId(interview.id);
                      setShowFeedbackModal(true);
                    }}
                  >
                    <i className="ri-edit-line"></i> Feedback
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleCancelInterview(interview.id)}
                  >
                    <i className="ri-close-line"></i> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{modalAction === 'open' ? 'Open Interview Slots' : 'Delete Interview Slots'}</h3>
            <p>
              {modalAction === 'open' 
                ? `Are you sure you want to open ${newSlotsCount} interview slot${newSlotsCount !== 1 ? 's' : ''}? Tutors will be able to book these slots.`
                : `Are you sure you want to delete ${existingSlotsCount} interview slot${existingSlotsCount !== 1 ? 's' : ''}? This action cannot be undone.`
              }
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                Cancel
              </button>
              <button 
                className={`btn ${modalAction === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                onClick={modalAction === 'open' ? handleOpenSlots : handleDeleteSlots}
              >
                {modalAction === 'open' ? 'Open Slots' : 'Delete Slots'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interview Feedback Modal */}
      {showFeedbackModal && feedbackInterviewId && (
        <InterviewFeedback
          interviewId={feedbackInterviewId}
          onClose={() => {
            setShowFeedbackModal(false);
            setFeedbackInterviewId(null);
          }}
          onSuccess={() => {
            setShowFeedbackModal(false);
            setFeedbackInterviewId(null);
            // Reload pending interviews
            interviewApi.getPendingInterviews().then(setPendingInterviews);
          }}
        />
      )}

      {/* Interview Result Modal */}
      {showResultModal && resultTutorId && (
        <InterviewResultModal
          tutorId={resultTutorId}
          tutorName={resultTutorName || undefined}
          onClose={() => {
            setShowResultModal(false);
            setResultTutorId(null);
            setResultTutorName(null);
          }}
        />
      )}
    </div>
  );
};

export default InterviewSchedulePage;
