'use client';

interface Domain {
  id: string;
  name: string;
  priority: string;
  taskCount?: number;
}

interface DomainCardProps {
  domain: Domain;
}

export default function DomainCard({ domain }: DomainCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case '1 - Critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case '2 - Important':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case '3 - Maintenance':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="p-4 rounded-lg border-2 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-2">{domain.name}</h3>
          <div className="flex flex-wrap gap-2 mb-2">
            <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(domain.priority)}`}>
              {domain.priority}
            </span>
            {domain.taskCount !== undefined && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {domain.taskCount} tasks
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
