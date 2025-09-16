import React, { useEffect, useState } from 'react';
import { getAllParents, deleteParent } from '../../services/authService';
import { Menu } from '@headlessui/react';
import { EllipsisVerticalIcon, FunnelIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import ConfirmDeleteModal from '../../components/admin/ConfirmDeleteModal';
import Loader from '../../components/Loader';

interface Parent {
  id: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  school?: string;
  gradeLevel?: string;
  profileImage?: string;
  children?: { name?: string; email?: string }[];
}

// Admin Parents list page for viewing all parents in the system
const Parents: React.FC = () => {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [parentToDelete, setParentToDelete] = useState<Parent | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [filterOption, setFilterOption] = useState<'all' | 'hasLinked' | 'noLinked'>('all');

  const fetchParents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllParents();
      setParents(data);
    } catch (err) {
      setError('Failed to load parents.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (parent: Parent) => {
    setParentToDelete(parent);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!parentToDelete) return;
    console.log("Deleting parent:", parentToDelete);
    setDeletingId(parentToDelete.id);
    try {
      await deleteParent(parentToDelete.id);
      await fetchParents();
      setIsDeleteModalOpen(false);
      setParentToDelete(null);
    } catch (err) {
      alert('Failed to delete parent.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchParents();
  }, []);

  let displayedParents = [...parents];
  // Sort by displayName A-Z by default
  displayedParents.sort((a, b) => {
    const nameA = (a.displayName || '').toLowerCase();
    const nameB = (b.displayName || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
  if (searchValue) {
    displayedParents = displayedParents.filter(p =>
      p.displayName?.toLowerCase().includes(searchValue.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchValue.toLowerCase())
    );
  }
  if (filterOption === 'hasLinked') {
    displayedParents = displayedParents.filter(p => Array.isArray(p.children) && p.children.length > 0);
  } else if (filterOption === 'noLinked') {
    displayedParents = displayedParents.filter(p => !Array.isArray(p.children) || p.children.length === 0);
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-2 sm:p-6">
        <div className="flex justify-between mb-4 items-center">
          <h2 className="text-2xl font-bold text-gray-800">Parents</h2>
        </div>
        {loading ? (
          <Loader label="Loading parents..." />
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : parents.length === 0 ? (
          <div className="text-gray-500">No parents found.</div>
        ) : (
          <div className="overflow-visible">
            <table className="min-w-full rounded-2xl">
              <thead>
                <tr className="bg-white shadow-sm rounded-t-2xl sticky top-0 z-10">
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider rounded-tl-2xl border-b border-gray-200">Name</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Phone Number</th>
                  <th className="px-6 py-5 text-left text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200">Linked Students</th>
                  <th className="px-6 py-5 text-right text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200" colSpan={2}>
                    <div className="flex justify-end items-center gap-2">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button type="button" className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center" aria-label="Filter">
                          <FunnelIcon className="w-5 h-5" />
                        </Menu.Button>
                        <Menu.Items className="origin-top-right absolute right-0 mt-6 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50 p-1 flex flex-col gap-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}`}
                                onClick={() => setFilterOption('all')}
                              >
                                All
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}`}
                                onClick={() => setFilterOption('hasLinked')}
                              >
                                Has Linked Students
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}`}
                                onClick={() => setFilterOption('noLinked')}
                              >
                                No Linked Students
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Menu>
                      <button
                        type="button"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full shadow flex items-center justify-center"
                        aria-label="Search"
                        onClick={() => setShowSearch((prev) => !prev)}
                      >
                        <MagnifyingGlassIcon className="w-5 h-5" />
                      </button>
                      {showSearch && (
                        <input
                          type="text"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 transition-all duration-150 ml-2"
                          placeholder="Search by name or email..."
                          value={searchValue}
                          onChange={e => setSearchValue(e.target.value)}
                          style={{ minWidth: 180 }}
                          autoFocus
                        />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedParents.map((parent) => (
                  <tr
                    key={parent.id}
                    className="transition-all duration-200 hover:bg-blue-200/70 hover:shadow-2xl hover:-translate-y-1 hover:border-blue-400 border-b border-gray-100 last:border-b-0 group"
                  >
                    <td className="px-6 py-6 whitespace-nowrap flex items-center gap-4">
                      <span className="w-12 h-12 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center overflow-hidden mr-2">
                        {parent.profileImage ? (
                          <img src={parent.profileImage} alt={parent.displayName || 'Profile'} className="w-full h-full object-cover rounded-full" />
                        ) : null}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-lg text-gray-900">{parent.displayName || '-'}</span>
                        <span className="text-xs text-gray-400">{parent.email || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 align-middle">{parent.phoneNumber || '-'}</td>
                    <td className="px-6 py-6 whitespace-nowrap text-sm text-gray-700 align-middle">{
                      Array.isArray(parent.children) && parent.children.length > 0
                        ? parent.children.map(child => child.name || child.email || '-').join(', ')
                        : '-'
                    }</td>
                    <td className="px-6 py-6 whitespace-nowrap text-right text-sm font-medium relative align-middle">
                      <Menu as="div" className="relative inline-block text-left">
                        <Menu.Button className="flex items-center p-2 rounded-full hover:bg-gray-100 focus:outline-none">
                          <EllipsisVerticalIcon className="w-5 h-5 text-gray-500" />
                        </Menu.Button>
                        <Menu.Items className="origin-top-right absolute right-0 mt-2 w-32 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 p-1 flex flex-col gap-1">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => handleDeleteClick(parent)}
                                className={`w-full text-left px-4 py-2 text-sm rounded-md transition-colors ${active ? 'bg-red-50 text-red-700' : 'text-red-600'}`}
                                disabled={deletingId === parent.id}
                              >
                                Delete
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setParentToDelete(null); }}
        onConfirm={handleConfirmDelete}
        loading={!!deletingId}
        message={parentToDelete ? `Are you sure you want to delete ${parentToDelete.displayName || parentToDelete.email || 'this parent'}? This action cannot be undone.` : ''}
      />
    </div>
  );
};

export default Parents;
// Route: /admin/parents 