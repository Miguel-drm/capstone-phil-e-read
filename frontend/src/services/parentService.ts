import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

console.log('🔥 PARENT SERVICE FILE LOADED 🔥');

export interface GradeSection {
  id: string;
  name: string;
  sectionName: string;
  gradeLevel?: number;
}

export interface Grade {
  id: string;
  name: string;
  sections: GradeSection[];
}

export interface GradesAndSectionsResponse {
  grades: Grade[];
}

class ParentService {
  // Get available grades and sections for parent request form
  async getGradesAndSections(): Promise<GradesAndSectionsResponse> {
    console.log('🚀🚀🚀 PARENT SERVICE FUNCTION CALLED 🚀🚀🚀');
    console.log('🚀 Starting getGradesAndSections...');
    console.log('🚀 Function called at:', new Date().toISOString());
    
    try {
      console.log('🔄 Fetching real data from Firebase...');
      
      // Get all documents from classGrades collection
      const gradesRef = collection(db, 'classGrades');
      const snapshot = await getDocs(gradesRef);
      
      console.log('📊 Firebase query successful, found', snapshot.docs.length, 'documents');
      
      const allGrades = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      // Filter to only Grade 3-6 and handle both old and new data structures
      const filteredGrades = allGrades.filter(grade => {
        // Check if new structure exists (gradeLevel field)
        if (grade.gradeLevel) {
          return grade.gradeLevel >= 3 && grade.gradeLevel <= 6;
        }
        // Fallback to old structure (parsing name field)
        const gradeNumber = parseInt(grade.name?.match(/\d+/)?.[0] || '0');
        return gradeNumber >= 3 && gradeNumber <= 6;
      });
      
      // Group by grade number for sections
      const gradesByNumber: { [key: string]: any[] } = {};
      filteredGrades.forEach(grade => {
        let gradeNumber: string;
        
        // Use new structure if available
        if (grade.gradeLevel) {
          gradeNumber = grade.gradeLevel.toString();
        } else {
          // Fallback to old structure
          gradeNumber = grade.name?.match(/\d+/)?.[0] || '0';
        }
        
        if (gradeNumber && gradeNumber !== '0') {
          if (!gradesByNumber[gradeNumber]) {
            gradesByNumber[gradeNumber] = [];
          }
          gradesByNumber[gradeNumber].push(grade);
        }
      });
      
      // Create response structure with real data
      const response = {
        grades: Object.keys(gradesByNumber).map(gradeNum => ({
          id: `grade${gradeNum}`,
          name: `Grade ${gradeNum}`,
          sections: gradesByNumber[gradeNum].map(grade => ({
            id: grade.id,
            name: grade.name || `${grade.gradeLevel} - ${grade.section}`,
            sectionName: grade.section || grade.name?.split('-')[1]?.trim() || grade.name,
            gradeLevel: grade.gradeLevel || parseInt(grade.name?.match(/\d+/)?.[0] || '0')
          }))
        }))
      };
      
      console.log('✅ Real Firebase data successful! Returning data:', response);
      return response;
      
    } catch (error) {
      console.error('❌ Firebase query failed:', error);
      console.log('🔄 Falling back to mock data for grade levels only...');
      
      // Fallback to mock data for grade levels, but with empty sections
      const mockResponse = {
        grades: [
          {
            id: 'grade3',
            name: 'Grade 3',
            sections: []
          },
          {
            id: 'grade4',
            name: 'Grade 4',
            sections: []
          },
          {
            id: 'grade5',
            name: 'Grade 5',
            sections: []
          },
          {
            id: 'grade6',
            name: 'Grade 6',
            sections: []
          }
        ]
      };
      
      console.log('✅ Mock data fallback successful! Returning data:', mockResponse);
      return mockResponse;
    }
  }
}

export const parentService = new ParentService();
