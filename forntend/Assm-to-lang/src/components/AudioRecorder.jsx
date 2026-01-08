import { useState, useRef, useEffect } from 'react';

const AudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [audioList, setAudioList] = useState([]);
  const [error, setError] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);

  const API_BASE_URL = 'http://localhost:5000/api';

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio({ blob: audioBlob, url: audioUrl });
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Error accessing microphone: ' + err.message);
      console.error('Error accessing microphone:', err);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // Upload audio to backend
  const uploadAudio = async () => {
    if (!recordedAudio) return;

    const formData = new FormData();
    formData.append('audio', recordedAudio.blob, 'recording.wav');
    
    setIsUploading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      
      // Refresh the audio list after successful upload
      fetchAudios();
    } catch (err) {
      setError('Error uploading audio: ' + err.message);
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Fetch list of uploaded audios
  const fetchAudios = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/audios`);
      if (!response.ok) throw new Error('Failed to fetch audios');
      const data = await response.json();
      setAudioList(data);
    } catch (err) {
      setError('Error fetching audio list: ' + err.message);
      console.error('Fetch audios error:', err);
    }
  };

  // Play selected audio
  const playAudio = (audioId) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = `${API_BASE_URL}/audio/${audioId}`;
      audioRef.current.play().catch(err => {
        setError('Error playing audio: ' + err.message);
      });
    }
  };

  // Load audio list on component mount
  useEffect(() => {
    fetchAudios();
  }, []);

  return (
    <div className="bg-slate-800 p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold mb-4 text-white">Audio Recorder</h2>
      
      {/* Audio Recording Controls */}
      <div className="mb-6">
        <div className="flex gap-4 mb-4">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`px-4 py-2 rounded-md font-medium ${
              isRecording 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
            disabled={isUploading}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          
          <button
            onClick={uploadAudio}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
            disabled={!recordedAudio || isUploading || isRecording}
          >
            {isUploading ? 'Uploading...' : 'Upload Audio'}
          </button>
        </div>
        
        {recordedAudio && (
          <div className="mt-4">
            <audio 
              src={recordedAudio.url} 
              controls 
              className="w-full"
              ref={audioRef}
            />
          </div>
        )}
      </div>

      {/* Audio List */}
      <div>
        <h3 className="text-lg font-medium mb-3 text-white">Recorded Audios</h3>
        {audioList.length > 0 ? (
          <ul className="space-y-2">
            {audioList.map((audio) => (
              <li 
                key={audio.id} 
                className="flex justify-between items-center bg-slate-700 p-3 rounded-md hover:bg-slate-600 transition-colors"
              >
                <span className="text-slate-200">
                  {audio.originalname || `Audio ${audio.id}`}
                </span>
                <button
                  onClick={() => playAudio(audio.id)}
                  className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm"
                >
                  Play
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">No audio recordings yet</p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
