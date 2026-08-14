
import V1App from '../App';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingDecision } from './components/OnboardingDecision';
import { OnboardingOverlay } from './components/OnboardingOverlay';

export default function App() {
  const { onboardingState, handleDecision, isLoaded } = useOnboarding();

  if (!isLoaded) return null;

  return (
    <>
      <V1App />
      
      {onboardingState === 'fresh' && (
        <OnboardingDecision onSelect={handleDecision} />
      )}
      
      {onboardingState === 'learning' && (
        <OnboardingOverlay 
          onComplete={() => handleDecision('completed')} 
        />
      )}
    </>
  );
}
