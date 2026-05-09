'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function InterviewSetupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    targetJobRole: '',
    yearsOfExperience: '',
    skills: [] as string[],
    interviewType: '',
    difficultyLevel: '',
    preferredLanguage: '',
    jobDescription: '',
    companyType: '',
    interviewDuration: '',
    focusAreas: [] as string[],
    voiceBasedInterview: '',
    mockInterviewGoal: '',
  });

  const [currentSkill, setCurrentSkill] = useState('');
  const [currentFocusArea, setCurrentFocusArea] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddSkill = () => {
    if (currentSkill.trim() && !formData.skills.includes(currentSkill.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, currentSkill.trim()] });
      setCurrentSkill('');
    }
  };

  const handleRemoveSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  };

  const handleAddFocusArea = () => {
    if (currentFocusArea.trim() && !formData.focusAreas.includes(currentFocusArea.trim())) {
      setFormData({ ...formData, focusAreas: [...formData.focusAreas, currentFocusArea.trim()] });
      setCurrentFocusArea('');
    }
  };

  const handleRemoveFocusArea = (area: string) => {
    setFormData({ ...formData, focusAreas: formData.focusAreas.filter(a => a !== area) });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validate required fields
    const newErrors: Record<string, string> = {};
    
    if (formData.skills.length === 0) {
      newErrors.skills = 'Please add at least one skill';
    }
    
    if (formData.focusAreas.length === 0) {
      newErrors.focusAreas = 'Please add at least one focus area';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: 'Authentication Required',
          description: 'Please sign in to start an interview',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }

      // Call FastAPI backend to start interview
      const response = await fetch('http://localhost:8000/api/interview/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          full_name: formData.fullName,
          email: formData.email,
          target_job_role: formData.targetJobRole,
          years_of_experience: formData.yearsOfExperience,
          skills: formData.skills,
          interview_type: formData.interviewType,
          difficulty_level: formData.difficultyLevel,
          preferred_language: formData.preferredLanguage,
          job_description: formData.jobDescription,
          company_type: formData.companyType,
          interview_duration: parseInt(formData.interviewDuration),
          focus_areas: formData.focusAreas,
          voice_based_interview: formData.voiceBasedInterview === 'yes',
          mock_interview_goal: formData.mockInterviewGoal,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to setup interview');
      }

      const result = await response.json();
      
      // Store interview setup data and session IDs
      sessionStorage.setItem('interviewSetup', JSON.stringify(formData));
      sessionStorage.setItem('interviewSessionId', result.session_id);
      sessionStorage.setItem('interviewSessionUuid', result.session_uuid);
      
      toast({
        title: 'Success!',
        description: 'AI Interviewer is ready. Starting session...',
      });
      
      // Navigate to interview page
      setTimeout(() => {
        router.push('/interview');
      }, 1000);
    } catch (error) {
      console.error('Error setting up interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to setup interview. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="text-3xl">AI Interview Setup</CardTitle>
          <CardDescription>
            Configure your mock interview preferences to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="your.email@example.com"
                required
              />
            </div>

            {/* Target Job Role */}
            <div className="space-y-2">
              <Label htmlFor="targetJobRole">Target Job Role *</Label>
              <Input
                id="targetJobRole"
                value={formData.targetJobRole}
                onChange={(e) => setFormData({ ...formData, targetJobRole: e.target.value })}
                placeholder="e.g., Frontend Developer, Data Analyst, AI Engineer"
                required
              />
            </div>

            {/* Years of Experience */}
            <div className="space-y-2">
              <Label htmlFor="yearsOfExperience">Years of Experience *</Label>
              <Select
                value={formData.yearsOfExperience}
                onValueChange={(value) => setFormData({ ...formData, yearsOfExperience: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fresher">Fresher</SelectItem>
                  <SelectItem value="1-2">1–2 Years</SelectItem>
                  <SelectItem value="3-5">3–5 Years</SelectItem>
                  <SelectItem value="experienced">Experienced (5+ Years)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Skills Known */}
            <div className="space-y-2">
              <Label htmlFor="skills">Skills Known *</Label>
              <div className="flex gap-2">
                <Input
                  id="skills"
                  value={currentSkill}
                  onChange={(e) => setCurrentSkill(e.target.value)}
                  placeholder="e.g., React, Python, SQL"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddSkill} variant="outline">
                  Add
                </Button>
              </div>
              {errors.skills && (
                <p className="text-sm text-red-500">{errors.skills}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.skills.map((skill) => (
                  <Badge key={skill} variant="secondary" className="px-3 py-1">
                    {skill}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveSkill(skill)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Preferred Interview Type */}
            <div className="space-y-2">
              <Label htmlFor="interviewType">Preferred Interview Type *</Label>
              <Select
                value={formData.interviewType}
                onValueChange={(value) => setFormData({ ...formData, interviewType: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interview type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical Interview</SelectItem>
                  <SelectItem value="hr">HR Interview</SelectItem>
                  <SelectItem value="behavioral">Behavioral Interview</SelectItem>
                  <SelectItem value="system-design">System Design Interview</SelectItem>
                  <SelectItem value="mixed">Mixed Interview</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Difficulty Level */}
            <div className="space-y-2">
              <Label htmlFor="difficultyLevel">Difficulty Level *</Label>
              <Select
                value={formData.difficultyLevel}
                onValueChange={(value) => setFormData({ ...formData, difficultyLevel: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Preferred Language */}
            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">Preferred Language *</Label>
              <Select
                value={formData.preferredLanguage}
                onValueChange={(value) => setFormData({ ...formData, preferredLanguage: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="tamil">Tamil</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                  <SelectItem value="french">French</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <Label htmlFor="jobDescription">Paste Job Description (Optional)</Label>
              <Textarea
                id="jobDescription"
                value={formData.jobDescription}
                onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                placeholder="Paste the job description here..."
                rows={4}
              />
            </div>

            {/* Company Type */}
            <div className="space-y-2">
              <Label htmlFor="companyType">Company Type *</Label>
              <Select
                value={formData.companyType}
                onValueChange={(value) => setFormData({ ...formData, companyType: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select company type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="startup">Startup</SelectItem>
                  <SelectItem value="product">Product-Based Company</SelectItem>
                  <SelectItem value="service">Service-Based Company</SelectItem>
                  <SelectItem value="faang">FAANG-Level</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Interview Duration */}
            <div className="space-y-2">
              <Label htmlFor="interviewDuration">Interview Duration *</Label>
              <Select
                value={formData.interviewDuration}
                onValueChange={(value) => setFormData({ ...formData, interviewDuration: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 Minutes</SelectItem>
                  <SelectItem value="20">20 Minutes</SelectItem>
                  <SelectItem value="30">30 Minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Focus Areas */}
            <div className="space-y-2">
              <Label htmlFor="focusAreas">Focus Areas *</Label>
              <div className="flex gap-2">
                <Input
                  id="focusAreas"
                  value={currentFocusArea}
                  onChange={(e) => setCurrentFocusArea(e.target.value)}
                  placeholder="e.g., DSA, React, System Design"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddFocusArea();
                    }
                  }}
                />
                <Button type="button" onClick={handleAddFocusArea} variant="outline">
                  Add
                </Button>
              </div>
              {errors.focusAreas && (
                <p className="text-sm text-red-500">{errors.focusAreas}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.focusAreas.map((area) => (
                  <Badge key={area} variant="secondary" className="px-3 py-1">
                    {area}
                    <X
                      className="ml-2 h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveFocusArea(area)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Voice-Based Interview */}
            <div className="space-y-2">
              <Label>Do you want voice-based interview? *</Label>
              <RadioGroup
                value={formData.voiceBasedInterview}
                onValueChange={(value) => setFormData({ ...formData, voiceBasedInterview: value })}
                required
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="voice-yes" />
                  <Label htmlFor="voice-yes" className="font-normal cursor-pointer">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="voice-no" />
                  <Label htmlFor="voice-no" className="font-normal cursor-pointer">No</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Mock Interview Goal */}
            <div className="space-y-2">
              <Label htmlFor="mockInterviewGoal">Mock Interview Goal *</Label>
              <Input
                id="mockInterviewGoal"
                value={formData.mockInterviewGoal}
                onChange={(e) => setFormData({ ...formData, mockInterviewGoal: e.target.value })}
                placeholder="e.g., Internship Preparation, Placement Preparation"
                required
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Setting up...' : 'Start Interview'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
