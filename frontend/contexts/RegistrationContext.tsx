import React, { createContext, useContext, useState } from 'react';

interface RegistrationData {
  username: string;
  nowId: string;
  email: string;
  password: string;
  profileImage: string;
}

interface RegistrationContextType {
  registrationData: RegistrationData;
  updateRegistrationData: (data: Partial<RegistrationData>) => void;
  clearRegistrationData: () => void;
  isStepValid: (step: keyof RegistrationData) => boolean;
}

const RegistrationContext = createContext<RegistrationContextType | undefined>(undefined);

export const useRegistration = () => {
  const context = useContext(RegistrationContext);
  if (!context) {
    throw new Error('useRegistration must be used within a RegistrationProvider');
  }
  return context;
};

export const RegistrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    username: '',
    nowId: '',
    email: '',
    password: '',
    profileImage: '',
  });

  const updateRegistrationData = (data: Partial<RegistrationData>) => {
    setRegistrationData(prev => ({ ...prev, ...data }));
  };

  const clearRegistrationData = () => {
    setRegistrationData({
      username: '',
      nowId: '',
      email: '',
      password: '',
      profileImage: '',
    });
  };

  const isStepValid = (step: keyof RegistrationData): boolean => {
    const value = registrationData[step];
    
    switch (step) {
      case 'username':
        return value.length >= 1;
      case 'nowId':
        return value.length >= 3;
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'password':
        return value.length >= 6;
      case 'profileImage':
        return value.length > 0;
      default:
        return false;
    }
  };

  const value: RegistrationContextType = {
    registrationData,
    updateRegistrationData,
    clearRegistrationData,
    isStepValid,
  };

  return (
    <RegistrationContext.Provider value={value}>
      {children}
    </RegistrationContext.Provider>
  );
}; 