// Simple in-memory database using Map
export const db = {
  users: new Map(),
  
  // Generate simple incremental IDs
  nextId: 1,
  
  generateId() {
    return (this.nextId++).toString();
  }
};